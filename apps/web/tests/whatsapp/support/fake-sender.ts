import type {
  SendInviteLinkInput,
  WhatsAppSender,
} from "../../../../../packages/domain/whatsapp/models";

export class FakeWhatsAppSender implements WhatsAppSender {
  readonly invitesSent: SendInviteLinkInput[] = [];
  readonly groupMessagesSent: Array<{ providerGroupId: string; body: string }> = [];
  readonly groupsCreated: Array<{ subject: string; description?: string }> = [];
  private sequence = 0;

  async sendInviteLink(input: SendInviteLinkInput): Promise<void> {
    this.invitesSent.push(input);
  }

  async sendGroupMessage(providerGroupId: string, body: string): Promise<void> {
    this.groupMessagesSent.push({ providerGroupId, body });
  }

  async createGroup(subject: string, description?: string) {
    this.groupsCreated.push({ subject, description });
    const id = `provider-group-${++this.sequence}`;
    return { providerGroupId: id, inviteLink: `https://chat.whatsapp.com/${id}` };
  }
}
