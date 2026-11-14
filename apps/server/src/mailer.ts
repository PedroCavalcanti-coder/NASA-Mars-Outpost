import { config } from './config';

/**
 * Envio de e-mails. Ainda não há provedor configurado: em desenvolvimento o conteúdo sai no
 * console do servidor (é assim que se pega o link de redefinição de senha).
 * Para produção, troque o corpo de `sendMail` por Resend/SMTP — o resto do código não muda.
 */
export async function sendMail(to: string, subject: string, body: string): Promise<void> {
  if (config.isProd) {
    console.warn(
      `[mailer] provedor de e-mail não configurado — mensagem "${subject}" não enviada.`,
    );
    return;
  }
  console.log(`\n✉️  Para: ${to}\n   Assunto: ${subject}\n   ${body}\n`);
}
