import { describe, expect, it } from "vitest";
import {
  getGoogleProfilePhotoUrl,
  renderGoogleProfilePhoto,
} from "../src/modules/google-profile-photo.js";

function createRoot() {
  document.body.innerHTML = '<div class="side-user"></div>';
  return document;
}

describe("Google profile photo", () => {
  it("usa somente a foto retornada pela conta Google", () => {
    const user = {
      user_metadata: {
        avatar_url: "https://example.com/google-avatar.jpg",
        picture: "https://example.com/fallback.jpg",
      },
    };

    expect(getGoogleProfilePhotoUrl(user)).toBe(
      "https://example.com/google-avatar.jpg",
    );

    const image = renderGoogleProfilePhoto(user, createRoot());
    expect(image?.id).toBe("googleProfilePhoto");
    expect(image?.src).toBe("https://example.com/google-avatar.jpg");
  });

  it("não cria avatar alternativo quando o Google não fornece foto", () => {
    const root = createRoot();
    expect(renderGoogleProfilePhoto({ user_metadata: {} }, root)).toBeNull();
    expect(root.getElementById("googleProfilePhoto")).toBeNull();
  });
});
