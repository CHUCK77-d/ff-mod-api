const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Configuração do Pool do Postgres com SSL obrigatório para o Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Rota GET para criar e salvar a chave
app.get('/api/save', async (req, res) => {
  const { key, duration } = req.query;

  if (!key) {
    return res.status(400).send('Erro: Parâmetro "key" em falta.');
  }

  const dias = duration ? parseInt(duration) : 7;
  
  // Data de expiração calculada com base nos dias escolhidos
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + dias);

  try {
    // Insere na tabela 'licenses' (ajusta o nome da tabela se necessário, ex: 'keys' ou 'licenses')
    const query = `
      INSERT INTO licenses (key_name, duration_days, expires_at, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT DO NOTHING;
    `;
    
    // Se a tua tabela se chamar apenas 'keys' ou 'chaves', muda 'licenses' na query acima.
    // Vamos garantir compatibilidade criante/gravando:
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
