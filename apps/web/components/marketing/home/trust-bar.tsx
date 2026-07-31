import { EyeIcon, MessageOffIcon, NoteIcon, ShieldCheckIcon } from "./icons";
import styles from "./home.module.css";

export interface TrustBarProps {
  label: string;
  verified: string;
  parentsSee: string;
  noPrivateMessaging: string;
  feedback: string;
}

export function TrustBar({
  label,
  verified,
  parentsSee,
  noPrivateMessaging,
  feedback,
}: TrustBarProps) {
  const items = [
    { icon: <ShieldCheckIcon />, text: verified },
    { icon: <EyeIcon />, text: parentsSee },
    { icon: <MessageOffIcon />, text: noPrivateMessaging },
    { icon: <NoteIcon />, text: feedback },
  ];
  return (
    <section className={styles.trustBar} aria-label={label}>
      <div className={styles.inner}>
        <ul className={styles.trustBarInner}>
          {items.map((item) => (
            <li className={styles.trustItem} key={item.text}>
              {item.icon}
              <span className={styles.trustItemText}>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
