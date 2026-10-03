/**
 * Outbound port through which Notifications instructs the outside email
 * executor (Strategy family: SES | SendGrid | LogOnly adapters).
 * The aggregate never sends; only the in-module event handler knows this port.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const EMAIL_SENDING_SERVICE = Symbol('EMAIL_SENDING_SERVICE');

export interface EmailSendingService {
  /**
   * Instructs the executor to send a rendered template to an address.
   * Outcomes are observed back via the UC2/UC3 webhooks, never returned here.
   * @param to Destination address (email shape).
   * @param templateKey Known template key.
   * @param values Render values for the template.
   */
  send(to: string, templateKey: string, values: Record<string, string>): Promise<void>;
}
