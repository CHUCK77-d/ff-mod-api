const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Conexão baseada em parâmetros individuais (elimina erros de string mal formatada)
const pool = new Pool({
  host: process.env.PGHOST || 'rpanwkvzsuhixnskidla.supabase.co',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '3K5QwKpS6RMM5ItP',
  database: process.env.PGDATABASE || 'postgres',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

app.get('/api/save', async (req, res) => {
  const { key, duration } = req.query;

  if (!key) {
    return res.status(400).send('Erro: Parâmetro "key" em falta.');
  }

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
    res.status(200).send('SUCESSO: Chave criada e salva no Supabase!');
  } catch (err) {
    console.error('Erro ao salvar no banco:', err.message);
    res.status(500).send('Erro 500: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API a correr na porta ${PORT}`);
});
