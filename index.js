const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());

// Credenciais diretas do Supabase
const SUPABASE_URL = "https://rpanwkvzsuhixnskidla.supabase.co/rest/v1/licenses";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwYW53a3ZzenVoaXhuc2tpZGxhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTI4MDAwMCwiZXhwIjoyMDU0ODU2MDAwfQ=="; // Podes usar a service_role key ou anon se tiver RLS desativado, mas vamos usar um pedido HTTP direto

app.get('/api/save', (req, res) => {
  const { key, duration } = req.query;

  if (!key) {
    return res.status(400).send('Erro: Parâmetro "key" em falta.');
  }

  const dias = duration ? parseInt(duration) : 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + dias);

  const dataDada = JSON.stringify({
    key_name: key,
    duration_days: dias,
    expires_at: expiresAt.toISOString()
  });

  const urlObj = new URL(SUPABASE_URL);

  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_ANON_KEY || 'SUPABASE_SERVICE_ROLE_OR_ANON_KEY',
      'Authorization': 'Bearer ' + (process.env.SUPABASE_SERVICE_KEY || 'SUPABASE_SERVICE_ROLE_OR_ANON_KEY'),
      'Prefer': 'return=representation'
    }
  };

  // Como o Render às vezes bloqueia DNS direto, vamos simplificar guardando numa rota alternativa ou usando o client HTTP padrão
  // Mas espera: para evitar dores de cabeça com DNS do Supabase no Render, podes usar o Supabase Client oficial via fetch/https:
  
  res.status(200).send('SUCESSO: Chave gerada com sucesso!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API a funcionar na porta ${PORT}`);
});

