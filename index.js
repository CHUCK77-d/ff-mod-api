
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Configuração da base de dados PostgreSQL interna do Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Inicializar a tabela de licenças automaticamente ao iniciar o servidor
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id SERIAL PRIMARY KEY,
        key_name TEXT UNIQUE NOT NULL,
        duration_days INT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Base de dados inicializada com sucesso!");
  } catch (err) {
    console.error("Erro ao inicializar a base de dados:", err.message);
  }
}
initDb();

// 1. Rota para gerar e guardar chave (Painel ADM)
app.get('/api/save', async (req, res) => {
  const { key, duration } = req.query;
  
  if (!key) {
    return res.status(400).send('Erro: Chave em falta.');
  }

  const cleanKey = key.trim();
  const dias = duration ? parseInt(duration) : 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + dias);

  try {
    const query = `
      INSERT INTO licenses (key_name, duration_days, expires_at, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (key_name) DO NOTHING;
    `;
    await pool.query(query, [cleanKey, dias, expiresAt]);
    res.status(200).send('SUCESSO: Chave criada e salva!');
  } catch (err) {
    console.error("Erro no /api/save:", err.message);
    res.status(500).send('Erro 500: ' + err.message);
  }
});

// 2. Rota para verificar chave (Painel Cliente)
app.get('/api/verify', async (req, res) => {
  const { key } = req.query;
  
  if (!key) {
    return res.status(400).send('Erro: Chave em falta.');
  }

  try {
    const cleanKey = key.trim();
    const result = await pool.query('SELECT * FROM licenses WHERE key_name = $1', [cleanKey]);
    
    if (result.rows.length === 0) {
      return res.status(404).send('Chave inválida ou não encontrada.');
    }

    const license = result.rows[0];
    const now = new Date();
    const expiresAt = new Date(license.expires_at);

    if (now > expiresAt) {
      return res.status(400).send('Chave expirada.');
    }

    res.status(200).send('SUCESSO: Acesso liberado!');
  } catch (err) {
    console.error("Erro no /api/verify:", err.message);
    res.status(500).send('Erro interno do servidor: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API a funcionar na porta ${PORT}`);
});
