const communicationNavItem = {
  id: "communication.inbox",
  label: "communication.nav.label",
  href: "/communication",
  roles: ["parent", "student", "tutor", "administrator", "super_administrator"] as const,
};

export default communicationNavItem;
