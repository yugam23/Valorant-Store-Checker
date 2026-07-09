/**
 * PDF generation utility for the Collection (Inventory) page.
 *
 * Architecture:
 *   1. `buildPdfHtml` — pure function that returns a Valorant-styled HTML string
 *      for a list of skins. Easily testable in isolation.
 *   2. `generateCollectionPdf` — orchestrates the async pipeline:
 *        render hidden HTML → html2canvas capture per page container → jsPDF pages → .save()
 *
 * Both `jspdf` and `html2canvas-pro` are dynamically imported so they never
 * appear in the main bundle — they only load when the user clicks "Export PDF".
 */

import type { OwnedSkin } from "@/types/inventory";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Design tokens mirrored from globals.css so the PDF matches the app. */
const COLORS = {
  void: "#0f1923",
  voidDeep: "#0a1118",
  valorantRed: "#ff4655",
  light: "#ece8e1",
  zinc400: "#a1a1aa",
  zinc500: "#71717a",
  zinc700: "#3f3f46",
  white10: "rgba(255,255,255,0.1)",
} as const;

/** A4 Landscape Dimensions at 120 DPI for high quality layout (aspect ratio 1.414) */
const PAGE_WIDTH = 1485;
const PAGE_HEIGHT = 1050;
const CARDS_PER_PAGE = 9;

/* ------------------------------------------------------------------ */
/*  Utils                                                              */
/* ------------------------------------------------------------------ */

/**
 * Splits an array into smaller chunks of a specified size.
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Escapes HTML special characters to prevent injection in the template.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ------------------------------------------------------------------ */
/*  HTML Builder                                                       */
/* ------------------------------------------------------------------ */

/**
 * Builds a single card for a skin entry (for a 3-column grid).
 */
function buildSkinCard(skin: OwnedSkin): string {
  const tierDisplay = skin.tierName ? escapeHtml(skin.tierName) : "Standard";
  const tierColor = skin.tierColor || COLORS.zinc500;

  const thumbnail = skin.displayIcon
    ? `<img src="${escapeHtml(skin.displayIcon)}" alt="" crossorigin="anonymous"
         style="width:100%; height:150px; object-fit:contain; padding:20px; box-sizing:border-box;" />`
    : `<div style="width:100%; height:150px; display:flex; align-items:center; justify-content:center;
         color:${COLORS.zinc500}; font-size:12px;">No image</div>`;

  return `
    <div style="width:calc(33.333% - 14px); background:${COLORS.voidDeep}; box-sizing:border-box; 
         position:relative; display:flex; flex-direction:column;">
      <!-- Accent Top/Left border -->
      <div style="position:absolute; top:0; left:0; right:0; height:2px; background:${tierColor};"></div>
      <div style="position:absolute; top:0; left:0; bottom:0; width:2px; background:${tierColor};"></div>
      
      <!-- Image area -->
      <div style="background:${COLORS.void}40; width:100%; display:flex; align-items:center; justify-content:center;">
        ${thumbnail}
      </div>

      <!-- Content area -->
      <div style="padding:20px;">
        <h3 style="margin:0 0 20px 0; font-size:16px; color:${COLORS.light}; text-transform:uppercase; font-weight:700; letter-spacing:0.05em;">
          ${escapeHtml(skin.displayName)}
        </h3>

        <!-- Footer line (Type & Tier) -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; padding-top:10px; border-top:1px solid ${COLORS.white10};">
          <span style="color:${COLORS.zinc400}; font-size:11px; text-transform:uppercase; letter-spacing:0.05em;">
            ${escapeHtml(skin.weaponName)}
          </span>
          <div style="display:flex; align-items:center; gap:6px;">
            <!-- Generic Hexagon Icon for Edition -->
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${tierColor}" stroke-width="2" style="margin-right:4px;">
              <path d="M12 2L22 7.77V16.23L12 22L2 16.23V7.77L12 2Z" />
            </svg>
            <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:${tierColor};">
              ${tierDisplay}
            </span>
          </div>
        </div>
      </div>
    </div>`;
}

/**
 * Builds the HTML container for a single A4 page slice.
 */
function buildPdfPageHtml(
  skinsChunk: OwnedSkin[],
  meta: { playerName?: string; rankIcon?: string } | undefined,
  pageNumber: number,
  totalPages: number,
  totalSkinsCount: number
): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = `${baseUrl}/icons/Valorant_Store_Checker.webp`;

  const playerLine = meta?.playerName
    ? `<div style="display:flex; align-items:center; gap:8px;">
         ${meta.rankIcon ? `<img src="${escapeHtml(meta.rankIcon)}" alt="Rank" crossorigin="anonymous" style="width:30px; height:30px; object-fit:contain;" />` : ''}
         <span style="color:${COLORS.zinc400}; font-size:24px; font-weight:400; text-transform:none; letter-spacing:normal;">
           ${escapeHtml(meta.playerName)}
         </span>
       </div>`
    : "";

  const headerHtml = `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:30px;
         border-bottom:2px solid ${COLORS.valorantRed}; padding-bottom:16px;">
      <div style="display:flex; flex-direction:column; align-items:flex-start; gap:16px;">
        <img src="${logoUrl}" alt="Logo" crossorigin="anonymous" style="width:200px; height:auto; object-fit:contain;" />
        <div style="display:flex; align-items:center; gap:16px;">
          <h1 style="margin:0; font-size:32px; text-transform:uppercase; letter-spacing:0.1em; line-height:1;">
            <span style="color:${COLORS.valorantRed};">VALORANT</span> COLLECTION
          </h1>
          ${playerLine}
        </div>
      </div>
      <div style="text-align:right;">
        <span style="color:${COLORS.zinc400}; font-size:13px;">${date}</span>
        <br/>
        <span style="color:${COLORS.valorantRed}; font-size:20px; font-weight:700;">
          ${totalSkinsCount} ${totalSkinsCount === 1 ? "Skin" : "Skins"}
        </span>
      </div>
    </div>`;

  if (skinsChunk.length === 0) {
    return `
      <div class="pdf-page-container" style="width:${PAGE_WIDTH}px; height:${PAGE_HEIGHT}px; background:${COLORS.void}; padding:40px; font-family:Arial,Helvetica,sans-serif; color:${COLORS.light}; box-sizing:border-box; display:flex; flex-direction:column; position:relative;">
        ${headerHtml}
        <p style="color:${COLORS.zinc400}; margin-top:40px; font-size:16px; text-align:center;">
          No skins to display.
        </p>
        <div style="margin-top:auto; padding-top:14px; border-top:1px solid ${COLORS.white10}; display:flex; justify-content:space-between; align-items:center;">
          <span style="color:${COLORS.zinc500}; font-size:11px;">
            Generated by Valorant Store Checker &middot; ${date}
          </span>
          <span style="color:${COLORS.zinc500}; font-size:11px;">
            Page ${pageNumber} of ${totalPages}
          </span>
        </div>
      </div>`;
  }

  const cards = skinsChunk.map((skin) => buildSkinCard(skin)).join("");

  return `
    <div class="pdf-page-container" style="width:${PAGE_WIDTH}px; height:${PAGE_HEIGHT}px; background:${COLORS.void}; padding:40px; font-family:Arial,Helvetica,sans-serif; color:${COLORS.light}; box-sizing:border-box; display:flex; flex-direction:column; position:relative;">
      <!-- Header -->
      ${headerHtml}

      <!-- Grid -->
      <div style="display:flex; flex-wrap:wrap; gap:21px; align-content:flex-start; flex:1;">
        ${cards}
      </div>

      <!-- Footer pinned to bottom -->
      <div style="margin-top:auto; padding-top:14px; border-top:1px solid ${COLORS.white10}; display:flex; justify-content:space-between; align-items:center;">
        <span style="color:${COLORS.zinc500}; font-size:11px;">
          Generated by Valorant Store Checker &middot; ${date}
        </span>
        <span style="color:${COLORS.zinc500}; font-size:11px;">
          Page ${pageNumber} of ${totalPages}
        </span>
      </div>
    </div>`;
}

/**
 * Builds the full PDF HTML document by combining multiple paginated containers.
 *
 * @param skins - The (filtered) list of skins to include.
 * @param meta  - Optional metadata (player name) to personalise the header.
 * @returns A complete HTML string ready to be rendered off-screen.
 */
export function buildPdfHtml(
  skins: OwnedSkin[],
  meta?: { playerName?: string; rankIcon?: string },
): string {
  if (skins.length === 0) {
    return buildPdfPageHtml([], meta, 1, 1, 0);
  }

  const chunks = chunkArray(skins, CARDS_PER_PAGE);
  return chunks
    .map((chunk, index) =>
      buildPdfPageHtml(chunk, meta, index + 1, chunks.length, skins.length)
    )
    .join("");
}

/* ------------------------------------------------------------------ */
/*  PDF Generator                                                      */
/* ------------------------------------------------------------------ */

/**
 * Generates and downloads a PDF of the user's skin collection.
 *
 * Pipeline: build HTML pages → mount off-screen → html2canvas per page → jsPDF → .save()
 *
 * @param skins - The (filtered) list of skins to include.
 * @param meta  - Optional metadata (player name).
 * @throws If html2canvas or jspdf fail to load or the capture fails.
 */
export async function generateCollectionPdf(
  skins: OwnedSkin[],
  meta?: { playerName?: string; rankIcon?: string },
): Promise<void> {
  // Dynamic imports — these never land in the main bundle.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // 1. Mount all styled HTML pages off-screen so the browser can render them.
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.innerHTML = buildPdfHtml(skins, meta);
  document.body.appendChild(container);

  try {
    // 2. Wait a tick for images to start loading, then capture.
    await new Promise((r) => setTimeout(r, 500));

    // 3. Build the PDF with A4 landscape
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // 4. Capture each page individually and add to PDF
    const pageElements = container.querySelectorAll(".pdf-page-container");

    for (let i = 0; i < pageElements.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const canvas = await html2canvas(pageElements[i] as HTMLElement, {
        scale: 2, // 2x scale for crisp Retina quality
        useCORS: true, // Allow cross-origin skin images
        backgroundColor: COLORS.void,
        logging: false,
      });

      // Export as JPEG with 0.9 quality to balance small file size with sharp text
      const pageData = canvas.toDataURL("image/jpeg", 0.9);
      
      pdf.addImage(pageData, "JPEG", 0, 0, pageWidth, pageHeight);
    }

    // 5. Download.
    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(`Valorant_Collection_${dateStr}.pdf`);
  } finally {
    // 6. Cleanup — always remove the off-screen container.
    document.body.removeChild(container);
  }
}
