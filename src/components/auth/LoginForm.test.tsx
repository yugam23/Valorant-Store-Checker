import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

// Mock next/image
vi.mock("next/image", () => ({
  default: function MockImage(props: React.ComponentProps<"img">) {
    return <img alt="" {...props} />;
  },
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  AlertCircle: function MockAlertCircle(props: Record<string, unknown>) {
    return <svg data-testid="alert-circle" {...props} />;
  },
  Loader2: function MockLoader2(props: Record<string, unknown>) {
    return <svg data-testid="loader-2" {...props} />;
  },
  Info: function MockInfo(props: Record<string, unknown>) {
    return <svg data-testid="info" {...props} />;
  },
}));

// Mock authenticateWithPaste action
vi.mock("@/actions/auth", () => ({
  authenticateWithPaste: vi.fn(),
}));

// Mock window.location
const originalLocation = window.location;
let storedHref = "";
Object.defineProperty(window, "location", {
  configurable: true,
  value: {
    ...originalLocation,
    get href() {
      return storedHref;
    },
    set href(url: string) {
      storedHref = url;
    },
  },
});

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedHref = "";
    (window.location as unknown as { href: string }).href = "";
  });

  describe("Renders the login form elements", () => {
    it("displays the sign in heading", () => {
      render(<LoginForm />);
      expect(screen.getByRole("heading", { name: /sign in/i })).toBeTruthy();
    });

    it("displays the paste input field", () => {
      render(<LoginForm />);
      const input = document.querySelector("input#pastedValue");
      expect(input).toBeTruthy();
    });

    it("displays the submit button", () => {
      render(<LoginForm />);
      const buttons = document.querySelectorAll("button");
      const submitButton = Array.from(buttons).find(b => b.textContent?.includes("Complete Login"));
      expect(submitButton).toBeTruthy();
    });
  });

  describe("Submit fires with correct payload", () => {
    it("calls authenticateWithPaste with pasted value on submit", async () => {
      const user = userEvent.setup();
      const { authenticateWithPaste } = await import("@/actions/auth");
      (authenticateWithPaste as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Invalid input",
      });

      render(<LoginForm />);

      const input = document.querySelector("input#pastedValue") as HTMLInputElement;
      await user.type(input, "https://playvalorant.com/opt_in?code=abc123");

      const buttons = document.querySelectorAll("button");
      const submitButton = Array.from(buttons).find(b => b.textContent?.includes("Complete Login"));
      await user.click(submitButton!);

      expect(authenticateWithPaste).toHaveBeenCalledTimes(1);
      expect(authenticateWithPaste).toHaveBeenCalledWith(
        "https://playvalorant.com/opt_in?code=abc123"
      );
    });
  });

  describe("Shows validation error on empty submit", () => {
    it("shows validation error when authentication fails", async () => {
      const user = userEvent.setup();
      const { authenticateWithPaste } = await import("@/actions/auth");
      (authenticateWithPaste as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Authentication failed. Please check your input.",
      });

      render(<LoginForm />);

      const input = document.querySelector("input#pastedValue") as HTMLInputElement;
      await user.type(input, "invalid-url");

      const buttons = document.querySelectorAll("button");
      const submitButton = Array.from(buttons).find(b => b.textContent?.includes("Complete Login"));
      await user.click(submitButton!);

      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeTruthy();
      });
    });
  });
});
