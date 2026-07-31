const paymentsNavItem = {
  id: "payments.overview",
  label: "payments.nav.label",
  href: "/payments",
  roles: ["parent", "finance", "administrator", "super_administrator"] as const,
};

export default paymentsNavItem;
