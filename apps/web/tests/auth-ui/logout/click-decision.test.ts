import { describe, expect, it } from "vitest";

import { decideLogoutClick } from "../../../components/auth/logout/click-decision";

describe("decideLogoutClick", () => {
  it("shows the confirm dialog when there is unsaved work (e.g. an active assessment attempt)", () => {
    expect(decideLogoutClick(true)).toBe("show_confirm_dialog");
  });

  it("proceeds immediately, with no nagging prompt, when there is nothing unsaved", () => {
    expect(decideLogoutClick(false)).toBe("proceed_immediately");
  });
});
