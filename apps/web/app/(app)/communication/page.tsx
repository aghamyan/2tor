import { CommunicationInbox } from "../../../components/communication/communication-inbox";
import { currentSession } from "../../../lib/current-session";

export default async function CommunicationPage() {
  const session = await currentSession();
  return <CommunicationInbox viewerUserId={session?.userId ?? null} />;
}
