import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SectionErrorBoundary } from "./SectionErrorBoundary";
import type { ReactNode } from "react";

function ThrowError({ message }: { message?: string }): ReactNode {
  throw new Error(message ?? "Test error");
}

describe("SectionErrorBoundary", () => {
  describe("Renders children normally", () => {
    it("displays child content when no error is thrown", () => {
      render(
        <SectionErrorBoundary sectionName="Test Section">
          <div data-testid="child-content">Hello from child</div>
        </SectionErrorBoundary>
      );

      expect(screen.getByTestId("child-content")).toBeTruthy();
      expect(screen.getByText("Hello from child")).toBeTruthy();
    });

    it("renders multiple children", () => {
      render(
        <SectionErrorBoundary sectionName="Test Section">
          <p>First child</p>
          <p>Second child</p>
        </SectionErrorBoundary>
      );

      expect(screen.getByText("First child")).toBeTruthy();
      expect(screen.getByText("Second child")).toBeTruthy();
    });
  });

  describe("Renders fallback UI when child throws", () => {
    it("displays fallback UI with section name when child throws", async () => {
      render(
        <SectionErrorBoundary sectionName="Daily Store">
          <ThrowError message="API Error" />
        </SectionErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText("Daily Store Unavailable")).toBeTruthy();
      });
    });

    it("displays retry button in fallback UI", async () => {
      render(
        <SectionErrorBoundary sectionName="Daily Store">
          <ThrowError />
        </SectionErrorBoundary>
      );

      await waitFor(() => {
        const buttons = document.querySelectorAll("button");
        const retryButton = Array.from(buttons).find(btn => btn.textContent?.includes("Retry"));
        expect(retryButton).toBeTruthy();
      });
    });
  });
});
