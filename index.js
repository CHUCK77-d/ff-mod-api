const express = require('express');
const { Pool } = require('pg');
const app = express();

// Para aceitar requisições em formato JSON enviadas pelo aplicativo Android
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Rota de criação de licenças (Agora acessível pelo Android sem exigir token na URL)
app.post('/api/licenses/create', async (req, res) => {
    const { key, duration } = req.body;
    
    if (!key) return res.status(400).send("Chave em falta");

    let expiresAt = new Date();
    const dias = parseInt(duration) || 7; // Padrão de 7 dias caso venha vazio

    if (dias >= 3600) {
        // Permanente (ano 2099)
        expiresAt.setFullYear(2099);
    } else {
        expiresAt.setDate(expiresAt.getDate() + dias);
    }

    try {
        await pool.query(
            "INSERT INTO licenses (ckey, status, expires_at) VALUES ($1, 'livre', $2) ON CONFLICT (ckey) DO NOTHING",
            [key, expiresAt]
        );
        res.status(201).send("SUCESSO");
    } catch (err) {
        res.status(500).send("Erro BD: " + err.message);
    }
});

// Mantém também a rota antiga por compatibilidade caso alguma outra parte use via GET
app.get('/api/save', async (req, res) => {
    const { key, duration } = req.query;
    if (!key) return res.status(400).send("Chave em falta");

    let expiresAt = new Date();
    if (duration === '1_dia' || duration === '1') expiresAt.setDate(expiresAt.getDate() + 1);
    else if (duration === '7_dias' || duration === '7') expiresAt.setDate(expiresAt.getDate() + 7);
    else if (duration === '1_mes' || duration === '30') expiresAt.setMonth(expiresAt.getMonth() + 1);
    else if (duration === 'permanente' || duration === '3650') expiresAt.setFullYear(2099);
    else expiresAt.setDate(expiresAt.getDate() + 7);

    try {
        await pool.query(
            "INSERT INTO licenses (ckey, status, expires_at) VALUES ($1, 'livre', $2) ON CONFLICT (ckey) DO NOTHING",
            [key, expiresAt]
        );
        res.send("SUCESSO");
    } catch (err) {
        res.status(500).send("Erro BD: " + err.message);
    }
});

app.get('/api/list_devices', async (req, res) => {
    try {
        const result = await pool.query("SELECT ckey, device_name, ip_address, last_active, status FROM licenses WHERE status != 'livre'");
        let devices = [];

        const now = Date.now();
        result.rows.forEach(row => {
            const devName = row.device_name || 'Desconhecido';
            const ipAddr = row.ip_address || 'IP N/D';
            const key = row.ckey;

            const lastActiveTime = row.last_active ? new Date(row.last_active).getTime() : 0;
            const isOnline = (now - lastActiveTime) < 300000;
            const statusBola = isOnline ? "🟢 ONLINE" : "🔴 OFFLINE";

            devices.push(`${statusBola} | ${devName} (${ipAddr}) | Chave: ${key}`);
        });

        if (devices.length === 0) {
            res.send("Nenhum dispositivo conectado.");
        } else {
            res.send(devices.join("\n"));
        }
    } catch (err) {
        res.status(500).send("Erro ao carregar dispositivos");
    }
});

app.get('/api/verify', async (req, res) => {
    const { key, device } = req.query;
    const ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const devName = device || 'Desconhecido';

    if (!key) return res.send("INVALIDA");

    try {
        const result = await pool.query("SELECT id, status, device_name FROM licenses WHERE ckey = $1", [key]);

        if (result.rows.length > 0) {
            const row = result.rows[0];

            if (row.status === 'usado' && row.device_name !== devName) {
                res.send("BLOQUEADO: Chave vinculada a outro aparelho!");
            } else {
                await pool.query(
                    "UPDATE licenses SET status = 'usado', device_name = $1, ip_address = $2, last_active = NOW() WHERE ckey = $3",
                    [devName, ipAddr, key]
                );
                res.send("AUTORIZADO");
            }
        } else {
            res.send("INVALIDA");
        }
    } catch (err) {
        res.status(500).send("ERRO_SERVIDOR");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));
