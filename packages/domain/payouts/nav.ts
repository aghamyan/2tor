const payoutsNavItem = {
  id: "payouts.overview",
  label: "payouts.nav.label",
  href: "/payouts",
  roles: ["tutor", "finance", "administrator", "super_administrator"] as const,
};

export default payoutsNavItem;
