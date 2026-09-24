# Template de verificação no EmailJS

Crie um template no painel do EmailJS com estes campos:

- **To Email:** `{{to_email}}`
- **Subject:** `Seu código de verificação Lembraí: {{auth_code}}`
- **Content:** copie o conteúdo de `emailjs-verificacao.html`

Variáveis enviadas pelo backend: `to_email`, `to_name`, `auth_code`, `expires_minutes` e `purpose_label`.

Depois, configure no backend: `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` e `CODIGO_VERIFICACAO_SEGREDO`.
