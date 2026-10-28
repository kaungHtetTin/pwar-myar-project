import React from "react";
import { useText } from "./i18n";

const platforms = { phone: "Phone", email: "Email", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", telegram: "Telegram", viber: "Viber", instagram: "Instagram", whatsapp: "WhatsApp" };

export function ShopContacts({ contacts }) {
  const text = useText();
  if (!contacts?.length) return null;
  return <section className="store-contacts" aria-label={text("Contact")}>
    <h2>{text("Contact")}</h2>
    <ul>{contacts.map((contact) => {
      const content = <><strong>{text(platforms[contact.platform] || contact.platform)}{contact.label && ` · ${contact.label}`}</strong><span>{contact.value}</span></>;
      const external = /^https?:\/\//i.test(contact.url || "");
      const safe = external || /^(tel:|mailto:)/i.test(contact.url || "");
      return <li key={contact.id}>{safe ? <a href={contact.url} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{content}</a> : <div>{content}</div>}</li>;
    })}</ul>
  </section>;
}
