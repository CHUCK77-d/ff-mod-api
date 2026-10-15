const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDb() {
  try {
    // Força a recriação da tabela de dispositivos para corrigir o conflito da restrição UNIQUE
    await pool.query(`DROP TABLE IF EXISTS active_devices;`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id SERIAL PRIMARY KEY,
        key_name TEXT UNIQUE NOT NULL,
        duration_days INT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS active_devices (
        id SERIAL PRIMARY KEY,
        key_name TEXT NOT NULL UNIQUE,
        device_name TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        last_seen TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Base de dados limpa e inicializada com sucesso!");
  } catch (err) {
    console.error("Erro ao inicializar a base de dados:", err.message);
  }
}
initDb();

// 1. Apenas cria e guarda a chave (Painel ADM)
app.get('/api/save', async (req, res) => {
  const { key, duration } = req.query;
  if (!key) return res.status(400).send('Erro: Chave em falta.');

  const cleanKey = key.trim();
  const dias = duration ? parseInt(duration) : 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + dias);

  try {
    await pool.query(
      `INSERT INTO licenses (key_name, duration_days, expires_at, created_at)
       VALUES ($1, $2, $3, NOW()) ON CONFLICT (key_name) DO NOTHING;`,
      [cleanKey, dias, expiresAt]
    );
    res.status(200).send('SUCESSO: Chave criada e salva!');
  } catch (err) {
    res.status(500).send('Erro 500: ' + err.message);
  }
});

// 2. Verifica a chave e regista o dispositivo do cliente
app.get('/api/verify', async (req, res) => {
  const { key, device } = req.query;
  if (!key) return res.status(400).send('Erro: Chave em falta.');

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP Desconhecido';
  const deviceName = device ? device.trim() : 'Android Device';
  const cleanKey = key.trim();

  try {
    const result = await pool.query('SELECT * FROM licenses WHERE key_name = $1', [cleanKey]);
    
    if (result.rows.length === 0) {
      return res.status(404).send('Chave inválida ou não encontrada.');
    }

    const license = result.rows[0];
    if (new Date() > new Date(license.expires_at)) {
      return res.status(400).send('Chave expirada.');
    }

    // Regista ou atualiza o dispositivo associado a esta chave de forma segura
    await pool.query(
      `INSERT INTO active_devices (key_name, device_name, ip_address, last_seen)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key_name) 
       DO UPDATE SET device_name = EXCLUDED.device_name, ip_address = EXCLUDED.ip_address, last_seen = NOW();`,
      [cleanKey, deviceName, clientIp]
    );

    res.status(200).send('SUCESSO: Acesso liberado!');
  } catch (err) {
    res.status(500).send('Erro interno: ' + err.message);
  }
});

// 3. Lista os dispositivos conectados para o Painel ADM
app.get('/api/devices', async (req, res) => {
  try {
    await pool.query(`DELETE FROM active_devices WHERE last_seen < NOW() - INTERVAL '10 minutes';`);
    const result = await pool.query('SELECT key_name, device_name, ip_address, last_seen FROM active_devices ORDER BY last_seen DESC;');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API a funcionar na porta ${PORT}`);
});

