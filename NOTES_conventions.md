# BRA (Blockchain: Research and Applications) Submission Conventions

Compiled 2026-07-13 from:
- Elsevier LaTeX instructions: https://www.elsevier.com/researcher/author/policies-and-guidelines/latex-instructions
- BRA Guide for Authors: https://www.sciencedirect.com/journal/blockchain-research-and-applications/publish/guide-for-authors
- Ground truth: the provided template zip (`template_src/elsarticle/`)

## Document class (ground truth from template zip)

The template zip contains the **elsarticle bundle** (elsarticle.dtx/.ins, templates, .bst files),
NOT the cas-sc/cas-dc classes. BRA's Guide for Authors explicitly says:
"You are recommended to use the Elsevier article class elsarticle.cls to prepare your
manuscript and BibTeX to generate your bibliography."

- Class options for initial submission: `\documentclass[preprint,12pt]{elsarticle}`
  (the template's own default). Add `review` only if double line spacing / line numbers
  are wanted; `final,5p,twocolumn` etc. are for journal-layout preview only, not submission.
- `elsarticle.cls` is not shipped compiled in the zip; it is extracted with
  `latex elsarticle.ins` or taken from the TeX distribution (it ships with MiKTeX/TeX Live).

## Reference style

- BRA uses **numbered references in square brackets, cited in order of appearance**
  ("Indicate references by number(s) in square brackets in line with the text ...
  Number the references in the list in the order in which they appear in the text").
- Correct BibTeX style: **`elsarticle-num.bst`** (in the template zip). Not elsarticle-harv
  (name-year) and not the cas equivalents. `elsarticle-num-names` is only for the
  natbib "Jones et al. [21]" variant, which BRA does not require.
- Every reference cited in text must be in the list and vice versa. DOIs encouraged.
- Web references: full URL plus last-accessed date.

## Front matter (elsarticle markup)

All inside `\begin{frontmatter} ... \end{frontmatter}`:
- `\title{}` (concise; avoid abbreviations/formulae where possible).
- `\author[label]{Name}` with `\affiliation[label]{organization={...}, addressline={...},
  city={...}, postcode={...}, country={...}}`.
- Corresponding author: `\author[...]{Name\corref{cor1}}` + `\cortext[cor1]{Corresponding author.}`
  + `\ead{email}`. Guide requires e-mail and full postal address for the corresponding author.
- Funding footnote: `\tnoteref{t1}` on the title + `\tnotetext[t1]{...}` (replaces IEEE `\tfootnote`).
  Note: Elsevier prefers funding in an "Acknowledgements"-adjacent funding statement formatted as
  "This work was supported by ... [grant number ...]"; keeping it as a title note is also accepted.
- Abstract: `\begin{abstract}...\end{abstract}` inside frontmatter. Must stand alone; no
  references; no non-standard abbreviations unless defined in the abstract itself.
  No explicit word limit stated in BRA's guide (Elsevier norm is <= ~250 words; ours is long
  at ~230 words -- acceptable, flag for later tightening).
- Keywords: `\begin{keyword} kw1 \sep kw2 ... \end{keyword}`, **maximum 6 keywords**,
  American spelling, avoid general/plural terms and multi-concept phrases.
  (IEEE version has 8 index terms -> must trim to 6.)

## Back matter required for Elsevier/BRA submissions

Placed after Conclusion, before the reference list:
1. **Declaration of competing interest** -- mandatory ("A competing interests statement is
   provided, even if the authors have no competing interests to declare").
2. **CRediT authorship contribution statement** -- required; corresponding author supplies
   each co-author's roles from the 14-role CRediT taxonomy.
3. **Data availability** statement -- Elsevier standard; journal "encourages" data sharing.
4. **Acknowledgements** -- separate section at end, before references (not a title footnote).
   Funding formatted per Elsevier convention.
5. **Declaration of generative AI and AI-assisted technologies in the manuscript preparation
   process** -- required when AI tools were used; goes in a new section before the references;
   published with the article. Exact section title above; statement follows the Elsevier
   template wording ("During the preparation of this work the author(s) used [TOOL] in order
   to [REASON]. After using this tool/service, the author(s) reviewed and edited the content
   as needed and take(s) full responsibility for the content of the published article.").

## Highlights

- **Optional but "highly encouraged"** at BRA.
- Separate editable file with 'Highlights' in the file name (submission system item).
- **3 to 5 bullet points, maximum 85 characters each including spaces.**
- The elsarticle class also has a `highlights` environment, but the journal wants a
  separate file; we provide `highlights.tex` as a standalone compilable file.

## Graphical abstract

- **Optional**, encouraged. Separate file; minimum 531 x 1328 px (h x w); readable at
  5 x 13 cm at 96 dpi; TIFF/EPS/PDF/MS Office. Not produced in this session.

## Language policy

- "Please write your text in good English (**American or British usage is accepted, but
  not a mixture of these**)."
- Manuscript is American English (IEEE convention) -- keep American throughout.
- British spellings found by scan (to flag, not silently change): see final report.
  Keywords must use American spelling.

## Submission mechanics worth knowing

- **"Your Paper Your Way"**: initial submission may be a single PDF; the properly
  formatted source is only demanded at revision. (We still produce clean elsarticle
  source now, since that was the task.)
- Editorial Manager requires **all submission files at the same folder level** -- no
  subfolders. Our working tree uses `figures/` + `\graphicspath` for tidiness; flatten
  (copy figures next to the .tex) when actually uploading.
- Peer review: single anonymized; no author-name blinding needed in the manuscript.
- Article types: full-length research papers, reviews, industry insights, short communications.
- Tables: editable text, no vertical rules or cell shading (our booktabs tables comply).
- Figures: EPS/PDF vector preferred; TIFF/JPG >= 300 dpi for halftones; indicate 1/1.5/2-column fit.
- Sections numbered 1, 1.1, 1.1.1 (elsarticle default) -- matches our structure.
- Author biographies: not used in BRA articles -> parked in `author_bios_parked.md`.
- APC: BRA is fully open access (APC applies; fee waivers historically via KeAi/Zhejiang
  University Press -- check at submission time).
- Editorial office contact: blockchain@zju.edu.cn
