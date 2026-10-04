# Heirloom design system — "the register"

## Step 1 decisions (locked; do not re-decide)

(a) Reference: a university special-collections finding aid and accession register. Ruled ledger pages, accession numbers in the margin, a typed "closed until" note under each item. Heirloom maps onto it directly: an asset is an item, a policy is a restriction note, a release window is a closing date.
(b) Type: display Gloock (400 only). Body Source Serif 4 (400; 600 for emphasis only). Azeret Mono (400) only for hashes, addresses, timestamps and accession numbers. Self-hosted through @fontsource so the IPFS recovery build needs no network.
(c) Palette: paper #E4DCC6, ink #1E1A15, accent verdigris #1C6B5A. Secondary tones are ink at 70% (secondary text) and 45% (rules, non-text only). Error is a separate tuned umber #8A2E1A, used only inside error states. No dark mode in v1.
(d) Radius: 2px, everywhere. No exceptions, nothing fully round.
(e) Layout: ledger page. Columns 1–2 are the margin (accession numbers, state stamps, dates); content starts at column 3. Uneven section heights separated by single 1px ink rules, with a double rule under each screen header. Left-aligned. No sidebar: one running header line (collection · role · page) plus text links.
(f) The loud element: the Restriction Line. The item's closing or opening time set in Gloock at clamp(6rem, 14vw, 12rem). Nothing else on any screen exceeds 3.8rem.

## Type scale (ratio 1.25, base 1rem)
0.8 · 1 · 1.25 · 1.563 · 1.953 · 2.441 · 3.052 · 3.815 rem. Headlines letter-spacing −0.02em. Body line-height 1.5, max-width 62ch.

## Components
- Surfaces are separated by 1px ink rules only. No shadows, no card fills, no gradients.
- State stamps (text label always, never color alone): Sealed = 1px solid border; Armed = dashed; Silent = dotted; Cooling = double; Disputed = 2px solid; Releasable = accent fill, paper text; ContingentEligible = 1px solid + "CONTINGENT"; Claimed = ink fill, paper text.
- Accent appears at most twice per screen: the single primary button, and one Releasable stamp. Nothing else.
- Buttons: primary = accent fill; secondary = 1px ink border; tertiary = underlined text. Hover differs by element: primary inverts to ink fill; secondary fills ink; links thicken underline 1px→2px; table rows grow a 3px ink left rule; inputs thicken bottom border. Focus-visible: 2px ink outline, 3px offset, on everything focusable.
- Forms: label in the margin column, ruled underline field. Errors: umber text plus a umber left rule, with the fix stated.
- Icons: none. Use words. (Maximum two, one set, one stroke width, if ever unavoidable.) No emoji, no decorative SVG. A QR code is functional and allowed.
- Motion only to communicate state: (1) on epoch reset, attestation lines are struck through over 200ms; (2) a new audit row opens its height over 150ms. Everything else is instant. `prefers-reduced-motion: reduce` removes both.

## Restriction Line copy by state
- Sealed: "Closed" / "Last owner signature 02 Oct. Nothing pending."
- Armed: "Closed" / "2 of 3 attestations filed. The owner has been told."
- Silent: "Closed" / "Owner silent since 19 Aug. No attestations yet."
- Cooling: "Opens in 1 d 04 h" / "The owner may cancel until then."
- Disputed: "Frozen" / "One guardian reported the owner alive."
- Releasable: "Open" / "Guardians may now hand over their shares."
- Claimed: "Claimed 12 Nov" / "Rotate the secrets in this item."
Durations are formatted from TIME_UNIT (days in production, minutes in demo).

## Required states on every data screen
- Empty: "No items are catalogued in this collection yet. Add the first one to set its restriction."
- Loading: static ruled blank lines plus a line of text such as "Reading the chain, block 14,203,118". No shimmer.
- Error: "The chain did not answer. Nothing was changed. Retry, or submit directly from a wallet." State what failed and what to do.

## Content rules
- Real, specific copy. No lorem ipsum, John Doe, Acme, round invented stats.
- Banned words: seamless, unlock, supercharge, elevate, empower, streamline, leverage, robust, effortless, next-generation, world-class.
- Anything not read from the chain or a fixture is sample data: irregular, realistic numbers, with one quiet line "Figures on this screen are sample data."
- Accession numbers: `HL-0007/03` (collection / item).
- Guardian blindness: a guardian's screen never names the other guardians. Show counts ("2 of 3 filed"), not people.

## Standing rules (from the brief)
Typography: never Inter, Roboto, Arial, Open Sans, Lato, Space Grotesk, Plus Jakarta Sans, Geist, or system fonts. Headlines negative tracking; body 400.
Color: no purple/indigo/violet gradients, no cyan-on-dark, no navy+orange, no gradient text, glow, blurred blobs or glassmorphism. At most one gradient on the page and only if it means something (we use none).
Layout: no centered hero; no hero→3 features→stats→testimonials→pricing→CTA; never three equal cards (three items become a list, table, numbered sequence, or unequal items); no sidebar.
Components: one radius; no icon-in-circle; no pill badge above headlines; no New/Live badges; no arrow on every button; no gradient borders.
Behavior: visible :focus-visible, loading/empty/error states, prefers-reduced-motion.

## Final audit (silent, fix, then output)
Does it look like a default template? More than 2 icons or 1 gradient? Centered-everything, equal-card rows, filler words? Does type and color show a point of view? If not, push one choice further. Then run `npm run audit:design` and `npm run audit:copy`.

## Amendment A1 (after the 4a review; overrides anything above that conflicts)
- Restriction Line: only the VALUE is the loud element ("1 d 04 h", "Closed", "Frozen", "Open", "Claimed 12 Nov"), Gloock, clamp(4rem, 9vw, 7.5rem), single line, white-space: nowrap, line-height 0.9. The label ("Opens in", "The owner may cancel until then.") is normal body size. It appears ONLY on item detail and the guardian release screen, never on the collection screen.
- No eyebrow labels. Mono (Azeret) is for accession numbers, hashes, addresses and timestamps only. Running header and margin labels are Source Serif, regular, 0.8rem, sentence case.
- No heading + subheading pairs. A paragraph under a heading must state a fact the user needs. Section headings max 1.563rem; the page title max 2.441rem.
- Signature device: summary information as a definition list with dot leaders (label, a flexible 1px dotted rule in ink 45%, value), as in a finding aid.
- Collection ledger: a header row (Accession, Item, Contents, Quorum, Window, Status), accession numbers in mono as the first column, tabular numerals, the item title is the only link (whole row clickable, hover = 3px left rule). No "Inspect" links.
- Sample content: plain, specific, irregular. No cliché titles. No descriptions under items; use facts ("9 files, 11 MB").
- No decorative or fake QR code. QR is added in Phase 8b with the real library.
- Dev routes are linked only in dev builds, in the footer.
