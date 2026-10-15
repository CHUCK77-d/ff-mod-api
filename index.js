
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.PGHOST || 'rpanwkvzsuhixnskidla.supabase.co',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '3K5QwKpS6RMM5ItP',
  database: process.env.PGDATABASE || 'postgres',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
  ssl: { rejectUnauthorized: false }
});

// Rota para gerar chaves (Painel ADM)
app.get('/api/save', async (req, res) => {
  const { key, duration } = req.query;
  if (!key) return res.status(400).send('Erro: Chave em falta.');

  const dias = duration ? parseInt(duration) : 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + dias);

  try {
    const query = `
      INSERT INTO licenses (key_name, duration_days, expires_at, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT DO NOTHING;
    `;
    await pool.query(query, [key, dias, expiresAt]);
    res.status(200).send('SUCESSO: Chave criada e salva!');
  } catch (err) {
    res.status(500).send('Erro 500: ' + err.message);
  }
});

// Rota para verificar chaves (Painel Cliente)
app.get('/api/verify', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).send('Erro: Chave em falta.');

  try {
    const result = await pool.query('SELECT * FROM licenses WHERE key_name = $1', [key]);
    
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
    res.status(500).send('Erro 500: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API a funcionar na porta ${PORT}`);
});
