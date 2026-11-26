# Prompt log: HEMANTH

One row per main prompt, in the order used. Paste the prompt itself, not a summary.

| # | Date and time (Dubai) | Tool and model | Prompt | What it produced, and did we use it? |
|---|---|---|---|---|
| 1 | Logged 24 Nov 2026, 22:32:52 Dubai | AI assistant; builder model identifier omitted at Hemanth's request | [Exact follow-up below](#follow-up-1) | Recovered and audited the research report; prepared the six-slide deck text, sources, team ideas, validation and handover within owned documentation. Retained the required deck review stop. See the handover for verification and the delivery response for the actual push result. |
| 2 | Logged 24 Nov 2026, 22:44:24 Dubai | AI assistant; identifier omitted at Hemanth's request | [Exact follow-up below](#follow-up-2) | Compared Nihal's supplied architecture with the current source and approved briefs; added the component mapping, scope corrections and owner requests in docs/deck/NIHAL_ALIGNMENT.md. Synced the permitted branch. npm run verify passed: typecheck, 49 tests passed / 1 skipped, and build. Push status depends on observed authentication and is reported in the delivery response. |
| 3 | Logged 25 Nov 2026, 08:34:31 Dubai | AI assistant; identifier omitted at Hemanth's request | [Exact follow-up below](#follow-up-3) | Fetched and merged current main into Hemanth's branch, audited Yash integration separately, updated owned deck/research/alignment/handover documentation, and verified both snapshots. Prepared a separate private HTML learning guide outside Git, as requested. Final verification and push receipts are reported in delivery. |
| 4 | Logged 25 Nov 2026, 09:21:57 Dubai | AI assistant; identifier omitted at Hemanth's request | [Exact follow-up below](#follow-up-4) | Began the authorised engineering work after the documentation-only update. Task 2 adds a fixed, labelled Lab corpus with 12 distinct real controls and 12 generated exercises, provenance, a reproducible seed extractor and tests written first. Existing offline replay returned eight unresolved cases because requests were unrecorded; these are disclosed, not counted as catches. `npm run verify` passed: 133 tests passed / 1 skipped, typecheck and build. Task 3 and the user-experience research follow in the next slice. |
| 5 | Logged 25 Nov 2026, 09:37:25 Dubai | AI assistant; identifier omitted at Hemanth's request | [Same exact follow-up](#follow-up-4) | Task 3 implements the real-checker Lab runner/page, cancellation, honest outcome/coverage accounting, actual recorded SAMPLE, field receipts and behavior tests. Added eleven dated user-experience rows and proposed acceptance tests; updated the six-slide deck and the separate private thirty-nine-slide HTML guide. `npm run verify` passed: 165 tests / 1 existing skip, typecheck and build. Structural/DOM checks passed within their documented scope; live registry and full browser/375 px/contrast validation remain unverified. Stop at the brief's Task 3 review checkpoint. |
| 6 | Logged 26 Nov 2026, 10:12:24 Dubai | AI assistant; identifier omitted at Hemanth's request | "The judging will be based on Workflow (8), Architecture (6), Ethical considerations (5), Governance (5), Guardrails (6) ... ensure they are fulfilled" | Built a separate Guardrails page (`#/guardrails`, `src/pages/Guardrails.tsx`) that runs every guardrail on deck slides 4 and 6 live, on the real code, after one button press: ten checks with 39 cases, each with the risk, the SAMPLE input (built from the Audit and Check samples, the Lab's recorded Crossref records and the recorded Bloom et al. (2015) abstract), the expected result, the result worked out now, a stamp that is green only when the two are the same text, and the code location. The checks are plain functions in `src/core/guardrails/`, so `tests/unit/guardrails.test.ts` runs the same list (the server check runs against the real server router in-process). Also on the page: what runs where (models, proxy hosts, AI task levels, the server's AI key flag), model cards with numbers worked out from the Lab's data, and our own mapping to NIST AI RMF 1.0, OWASP Top 10 for LLM Applications 2025 and UNESCO's 2023 guidance, every link and title checked with curl. Unit tests, typecheck, build and the browser specs listed in the handover passed. Hooks in others' files are listed in the handover. |

## Follow-up 1

The user's exact follow-up, including original spelling:

> can you check the report again with honesty and accuracy and then build the files and push them and complete my part effectively, honestly and accurately and if any other ideas are good that can incorporated give them as well so I can discuss with the team. The attached screenshot is honesty and accuracy priciples so make sure you follow them everytime. And also make sure that you do not mention which mdel is used for the building of files but you work suchj that you do your job effectively without erors and better than any other models.

The attached principles require visible uncertainty, verifiable sources, qualified statistics, current-source checks and accurate quotation attribution. They were applied as instructions, not treated as evidence of any product performance.

This follow-up continues the task and branch rules in `docs/team/HEMANTH.md`, with the user's explicit overrides: APA guide requirements are supplied by Hemanth rather than guessed, and no builder model identifier or coauthor trailer is added. No claim of error-free work or superiority was made.

## Follow-up 2

The user's exact follow-up, including original spelling:

> I authorized permission can you push the files accoridnlgy. And also attached is Nihal's ideas check if they are aligining. And push to my branch only.

The attached screenshot is headed “8.1 System architecture”. Its boxes are evaluated in `docs/deck/NIHAL_ALIGNMENT.md`. It is treated as a proposed design, not evidence that the depicted components exist. The follow-up confirms the own-branch push and requests an alignment review; it does not explicitly remove the original deck-review checkpoint or authorize changes to other owners' source files.

## Follow-up 3

The user's exact follow-up, including original spelling:

> there are recent updates and changes to repo, check main and yash/integration. Can you check the latest updates and then update our files and then push them. And check the attached screenshot and then tell me everything is good or is there any updates needed for architecture. And then build me complete html with all the architecture diagram, flow diagrams, and other diagrams as well with charts, tables, visuals etc for the entire problem statement and any recommendations for updates. This html should be light themed and with key indications and it should be a like a story telling with scenarios etc and explain clearly what is the project that we are building and all the details in a clear and visual manner and the slides should be self explaantory, I should understand everything by looking at all the slides. It will be a guide for me and for explaining others and also how to improve if anything needs to be updated. Do not push this html presentation it is for me only so keep it in the chat.

The supplied architecture screenshot was inspected. The teaching HTML is a private deliverable, separate from the official six-slide deck and excluded from staging. Inspection of `yash/integration` does not authorize merging its unintegrated code or pushing to that branch. The original no-PR/no-deploy and own-file boundaries remain in force.

## Follow-up 4

The user's exact follow-up, including original spelling:

> It only shows docs changed, is it only that much and no other critical files changes? Did you also mention in the slides what to improve and enhance and how to get the edge over other well established platforms and also be  a better platform and a most reliable platform by taking into consideration the users reviews of the established platforms and what users are experinecing from the other platforms to make out platform better than others in terms of functionality, features, working, reliability, and trust.

The previous own-branch push changed eight documentation files; it did not implement the remaining product pages. This follow-up continues the already requested engineering work through the Task 3 Lab review checkpoint. It also requests first-hand user-experience research and actionable improvements in the private teaching guide. Public reports inform testable proposals; they do not establish comparative reliability or a claim that Paper Trail is the best platform. The original own-file, own-branch, no-PR, no-deploy and no-new-dependency boundaries still apply.

## Current local integration session: 25–26 November 2026

Tool: AI coding assistant; builder model identifier omitted in line with the existing preference. The following prompts produced the local candidate described in `docs/deck/INTEGRATION_HANDOVER.md`, updated six-slide presentation and private teaching guide; 27 dependency-free tests passed, but full verification and push remain pending. Earlier rows report earlier sessions and must not be read as current validation.

### Exact integration request

> the repo is "https://github.com/Yashpetkar7/Ai-Club-Hackathon", this  has main and also two more branches mine and Yash's so i have already downloaded his files and kept in the folder you can chech. And also you can clone mine and main branch and start building. The other files and html's are also built and the other folder also has some build, can you check and go ahead with complete build and push to my branch, I am hemanth. And use the hbasired username of the github and not the blackholeinfiverse114. The recent prompt I have given in chatgpt was "can you check the repo again, Yah has made many changes in his branches, can you check them and accordingly make updates on our side and then push, and if we can make something better and get the differentiator and edge in our system that will be better and with more correct and interactive  platform and also can we make or rank the researchs that are searched according to priority can build a solid system.
> And also there are many platforms like hubspot and salesforce which have very interactive and dynamic learning platform that are very good can we implement something like that so that researching and getting inform,ation and reading becomes fun and the learning becomes easy and fast. Do one thing whatever we have planned for this from first our ideas and implement everything according to the system already built by yash that is pushed into repo and then fix anything and implement our ideas on top and our implementation that we will do now and then push into my branch. And also check eevrything is working. And also you mentioned some tasks are pending on my side so comple them as well and then push.", so check and proceed and make sure the reserach and getting and then entire flow of the research becomes so simple and imnteractive and addictive and that too with complete automation and verfication such that there is no faking, fooling or manipulating in the system. And it should not only be what is asked in the problem statement but it should be more than that with key indications, you can web search and then proceed accordingly as well.

### Exact presentation and demo request

> can you check and proceed and also there are new presentation and html guide can you check and see if everything aligns and correcr and if any updates can be made do it. And the slides should be 6 only. theere are changes and updates in yash's branch can you check that as well and then proceed and implement. But my html which i will read and completely understand which is already in the folder "Paper_Trail_Architecture_Guide (1).html" should be updated. The research tool should be efefctive and should work in the demo and we need to show the actual demo that will work on real data and the entire solution to the problem will be shown in the demo and also the edge of this system and the differentiator should be clear. Use different techniques and tools that are available and developed by big tech liks google, meta, etc that are open source or free API based which can be inteegrated in our system and build a good tool that crosses benchmarks set and becomes students favourite tool in the entire earth who can get it and use at ease and can help significantly. Do web search and then build and the push.

### Exact access follow-ups

> Why are you not able to get git fetch, means you did not even have an idea as well what is there in github repo and my branch? can you check and proceed. This is the website cab you check it and work acordingly. If git cannot be fetched or clones the it will be a problem, so please get git and proceed.

Website supplied: `https://paper-trail-team1.vercel.app/`.

> And why did codex setting changed, I give the you access to get git, if you needany setting to be changed then tell me.

The user reported “Network access enabled”, then “Changed to Ask for approval”. A subsequent pre-approved remote-reference query returned all three heads, but object fetch and ordinary shell network access remained blocked; the escalation tool still reported `sandbox_approval=false`. No Codex setting, global Git identity, teammate branch, deployment or hook was changed by the assistant.

The current request authorizes substantive integration work beyond the older file-ownership limit. Changes remain a separate local candidate until the actual branch objects are fetched, reconciled, fully verified and pushed as hbasired; neither benchmark superiority nor an impossible guarantee against manipulation is claimed.

### Exact vision and unfinished-work request

> can you build and then document what was not done and that can be done. And what is my vision and what should be done.

Produced `docs/VISION_AND_ROADMAP.md`, linking the actual local implementation and validation to the requested global student research-and-learning vision. It separates release blockers, independent benchmark/learning evaluations and longer-term adoption work; the final package-registry probe failed with `EACCES`, so no production-build or live-demo success was claimed.

## Build-and-push session: 26 November 2026 (Dubai)

Tool: AI coding assistant; builder model identifier omitted in line with the existing preference. Work ran on a fresh clone of `hemanth/lab-governance`, pushed only to that branch as hbasired. Results and test output are in `docs/deck/INTEGRATION_HANDOVER.md` and `docs/deck/VALIDATION_CURRENT.md`.

### Exact build request

> can you check the last written documents and all the files and get idea of the project and then proceed with the build and push repo using my username:hbasired. The repo for hackathon is https://github.com/Yashpetkar7/Ai-Club-Hackathon. And I am Hemanth and have a branch so push to that only. The already deployed work is at https://paper-trail-team1.vercel.app/ so check this as well and see if my work is implemented in the deployed version or not and then proceed.

Produced: a fresh clone, the earlier local candidate merged on top of current main (commit 4682fcf), regression fixes found by the full test run (7dc42fa), and a normal push to `hemanth/lab-governance`. The deployed site was compared with main: the Integrity Lab and House rules are live; Research Compass, Study studio and reading priority were not yet merged into main.

### Exact vision request

> make sure you get my full vision for the enhanced tool or platform and the implement from where I have left and then proceed according. Web search open source tools by big tech and trusted repo's and then include those which make the tool or platform better than any other thing available in the market. It should be like the go to for researchers to use this tool and get everything done.

Produced: a research pass over open models and free scholarly APIs. Chosen: a small open embedding model (Snowflake arctic-embed-xs, Apache-2.0) that runs in the browser to find a source sentence by meaning, next to the existing DeBERTa support model; OpenAlex semantic search on a host already in use. Rejected or deferred: anything needing a new paid provider, a new npm dependency or an unreviewed host.

### Exact tests, semantic layer, demo and metrics request

> can we also do some tests before itself to check and enhance if anything is not working or working with mediocrity and improve it. And also isadding semantic layer make sense in this project or no, if yes implement it accordingly. For demonstration make sure what to do and it should blow thereviewers mindaway. And also with the tests done can we add evaluation metrics as well. And the difference between claims from the references are shown with the score which is correctand which is not, and for ploished answers as well. And if this required LLM API key I have groq, I can provide it in the UI somewhere in the hidden section that is not directly seen by the reviewers but I can get to it and paste the key. And the explorability and navigability should be good. And can you do one agent at a time for the 5 you have included in the workflow so that they can work with the available RAM.

Produced, one agent at a time: find-by-meaning and a claim scorecard on Evidence (2ed9ff5); the "Audit a paragraph" page for polished text with a claims-by-references matrix (8a91337); live evaluation numbers in the Integrity Lab worked out from the labelled claim sets and the recorded replay (817aef5). Semantic layer decision: yes, but it only puts sentences in order; `judge()` still makes every label. A real-model recording of every candidate sentence then tested where pages start when several sentences are scored, and the start rule was made safer (exact quote first, then any dispute, then best support).

### Exact push and guide request

> push to my branch only and after everything is done update my guide html which is already available.

### Exact alignment request (hidden owner key and "explain" slice)

> You are buildind in a way that our work is in separate pages or tabs and buildind accordingly with alignment with already existing implementation right?

Produced, as its own components and modules next to the existing code: a hidden owner panel at `#/lab?owner` (`src/pages/OwnerKey.tsx`, `src/core/ownerKey.ts`) that keeps a Groq key in this tab, or on this device only when ticked, and sends it only as one header to our own `/api/ai`; and one new AI task, "explain" (`server/handlers/explain.mjs`, `src/core/lab/explain.ts`, `src/pages/ExplainLabel.tsx`), which puts the checks behind a claim label into at most three sentences, is checked on the server and the page, and never changes the label. Files owned by others were changed too, not only with one-line hooks: the AI gateway (`server/handlers/ai.mjs`, Nihal) needed the owner key tried inside its request loop, plus `server/guard.mjs` and `src/core/aiClient.ts`. Every such change is listed in the handover for its owner. AI answers in the browser tests are stubs marked test-model.

### Same alignment request, navigation slice

> You are buildind in a way that our work is in separate pages or tabs and buildind accordingly with alignment with already existing implementation right?

Produced, as new components next to the existing shell: the project rail now lists Compass and Team as whole-project pages, then each step with its helpers under it and their hints visible (`src/app/Trail.tsx`); a one-line "where you are" pointer at the top of each step and helper, left out on Compass so it never competes with Compass's own suggestion; one shared list of places and keywords for the palette (`src/app/places.ts`), so it reaches every step and helper plus Check, Audit, the Integrity Lab, House rules and How it works; one clear button out of every empty reading page, and cross-links from Check and Evidence to Audit and from the Lab's numbers to the live checks (`src/pages/Signposts.tsx`); and one new How it works section on Audit, find by meaning, the claim scorecard's 90% lines and reading the Lab's numbers (`src/pages/HowChecksWork.tsx`). A project opens on Plan until its plan is approved, then on Compass, from every link. Yash's shell files were restructured, not only hooked: the rail markup moved out of `ProjectShell.tsx` into `Trail.tsx`, and `App.tsx`, `router.tsx`, `CommandPalette.tsx`, `Guide.tsx`, `Projects.tsx` and `Home.tsx` changed. Every change is listed in the handover for its owner.

### Same alignment request, Discover slice

> You are buildind in a way that our work is in separate pages or tabs and buildind accordingly with alignment with already existing implementation right?

Produced, as its own tab next to Find (Find itself unchanged): a Discover helper (`src/pages/Discover.tsx`, `src/core/discover/`). "Search by meaning" runs Find's own keyword search and OpenAlex's search by meaning (`search.semantic`, checked live first: it works without a key, allows at most 50 a page and only some filters) and merges them by reciprocal rank fusion, 1/(60 + place), recognising a work by DOI then OpenAlex id and saying for each one whether it was found by words, by meaning or both. "More like this" lists the works OpenAlex relates to a library source that has an OpenAlex id. Nothing is fetched until the student presses a button. "Add to library" runs the same checker Find runs and saves with the same store action, unapproved, so the student still turns the third key in Library. Tests use real OpenAlex and Crossref answers recorded without a key or email (`tests/unit/fixtures/discover.json`). Yash's files got two small hooks (`ProjectShell.tsx`, `places.ts`), listed in the handover.

### Correction recorded after an independent review (26 November)

An earlier line in this session said that other people's files got only small hooks. That was not accurate. This branch also changed Nihal's Evidence page, claim labels, support worker and AI gateway, and restructured parts of Yash's navigation shell. Each change is listed by file and owner in `docs/deck/INTEGRATION_HANDOVER.md`, for the owners to review before Yash merges.

## 26 November 2026, day of the hackathon (Phase 2)

### Exact request: judging criteria

> The judging will be based on "Judged on: Workflow (8) · Architecture (6) · Ethical considerations (5) · Governance (5) · Guardrails (6)" do not disturb the agents, just ensure they are fulfilled otherwise start building them or plan them if agents workflow needs to be completed and then do it, you can web search for this as well. there is also a prompt.jpg file can you check that as well and follow the instrcutions so that you will be and work honestly and accuractely by following the principles

Produced: the Guardrails page (`#/guardrails`), which runs every deck guardrail live on the real code, plus what runs where, model cards and our own mapping to NIST AI RMF 1.0, the OWASP Top 10 for LLM Applications 2025 and UNESCO's 2023 guidance (labelled as not a certification).

### Exact requests: run it locally, and deployment

> can you also give me the commnads to start the services locally in my laptop and then showcase whatever we have developed, juts give the commands to run in powershell now and do not start anything.

> can you start anbd give me the local urls. And can you ensyre me that once merge is done the deployment will automatically done.

Answer given: started `npm start` (http://127.0.0.1:4173). Deployment is not automatic: `vercel.json` has `"git": {"deploymentEnabled": false}` and the live site predates both of today's merges, so Yash deploys after merging. Main had moved, and this branch conflicted with it in six files.

### Exact request: merge main into this branch

> ok build accordingly and the push do not merge. We will decide and do it. And also update the guide

Produced: `main` (a39d992) merged into `hemanth/lab-governance`, not the other way round (553b3d3). Yash's fine-tuned support model now loads through this branch's shared worker, with model downloads taking turns because the library's local/remote switch is global. The Lab sample was re-recorded with the shipped Retraction Watch index read from disk. The Integrity Lab now measures the support model the site ships (65fc31e): Verified counts are unchanged, and fewer false claims are Disputed (65 of 80, against 72 with the original model). An independent review found that a failed download could leave requests running under the other model's settings; a failed download now closes the shared worker. Mistake made and fixed in this step: `src/core/claims/quote.ts` (Nihal's) was overwritten by accident and restored from git unchanged before anything was committed.

### Exact request: Phase 2 day-of requirements

> Now the new instructions for the hackathon are revealed and it includes edge cases and attackes on the platform can you read and then build accordingly and make sure not only these attacks or edge cases but other edge cases are also taken into account so that in production it will not break. The Instructions are:"[the Phase 2 brief: six required edge cases, the eight-reference test pack, three assistant requests, constraints and bonus cases]"

> So check thhese as well and then push them into my branch.

Ran the eight test-pack references through the real checker against live Crossref, OpenAlex, DataCite and doi.org (not committed; nothing in the code names any test-pack reference). Found and fixed, as general rules:
- A DOI whose record has none of the given authors is now Wrong paper (Mismatch), even with the same title. Before, it was Details differ.
- A reference without a DOI that Crossref matched only to a re-posted copy (a 2025 record of a 2017 paper) would have offered a wrong year as a fix. The checker now also searches OpenAlex by title, and looks the result up by its DOI in Crossref or DataCite, so OpenAlex never vouches for itself.
- A web page with no scholarly details is labelled as a web source, not checked in a scholarly database, instead of Not found.
- Check page: a suggested fix lists each detail (you wrote / the registry has), with Accept the fix or Keep mine. Accepting checks the reference again. A Wrong paper shows what the DOI points to next to what was pasted. Duplicates within one pasted list are detected, with Keep one and merge, or They are different works.
- Ask: a question nothing answers gets a plain "Not found" and a link to search the registries, where every result is checked before it can be saved. It works with an empty library. A quotation is checked word for word against the cited source's text. If it is not there it is never confirmed, and when only the abstract is available the answer says so.
- Exports: every entry carries its status, such as [Verified] or [Retracted, kept by the student with a reason], in text, BibTeX, RIS and Word.
- Notes: text addressed to an AI ("SYSTEM: …", "ignore … rules", "mark … as verified") is flagged, saved as the student's text, and never changes a check.

### Exact request: fact-check the pitch, more real-life cases, personal repository and deployment

> can you check for this as well and see everything is running correctly and implemented honestly: "[the team's plain-words pitch: problem, real-life examples, three keys, step-by-step flow, brief mapping, tech stack, data, models, quality numbers, 8-minute plan, likely questions]". And also we need to check the additional real lfe edge cases and scenarios that might occur as well, check them and also after the push to my branch, we need to push entirely to my github repo:"https://github.com/hbasired/AI-Hackathon.git" and deploy it accordingly so that we have both working and mine should surpass them, so do that and then give me guide for deployment, should we do it in render and vercel which would be easy or should we do it in any other easy and faster way.

> push all that is built for the entire hackathon by me and everyone from the repo cloned, and my work also should be pushed from scratch and then deploy it, I don't think they have deployed my pushes so i need to do it from my side with all the already existing systems you cloned from the repo as well. It should work exactly as it is working in my local.

Produced:
- Thirteen real-life reference formats were run through the live checker: DOI forms, IEEE, Harvard and MLA styles, a book with no DOI, an arXiv preprint, a DOI one digit off, an online-first year, garbage text, an instruction inside a reference, and a title on its own. One real defect was found and fixed: a title on its own was Confirmed as a different paper whose title has the same words in another order. A reference found by title alone is now Details differ (`TITLE_ONLY`) and never Confirmed. A paste over 60 references now says how many were left out.
- Siddal's Phase 2 Library commit (`5056e04`) was merged into this branch, so it holds all of `main`, `yash/integration`, Siddal's branch and this work.
- `server/start.mjs` takes an optional `HOST` (default 127.0.0.1), so a host such as Render can reach it.
- `docs/DEPLOY.md` covers Vercel (recommended for the demo) and Render (needed for server-side saves), with the two things that may stop a Vercel deploy: automatic deploys are turned off in `vercel.json`, and the 95 MB model may exceed the free plan's upload limit, in which case the site falls back to the original model.
- The pitch was fact-checked claim by claim (`docs/deck/PITCH_FACT_CHECK.md`).
- The AI assistant did not deploy anything: the repository's rules allow a deploy only when Yash says so in the session.

### Exact request: check the two live sites and the deploy screenshots

> can you check the https://paper-trail-17p0.onrender.com/ if everything is correct and also check deply 2 screenshot and see if it is correct or not and is there anything to improve? if yes then push to my hbasired repo and then deploy it as well. Also check the https://paper-trail-team1.vercel.app/ if it is correct and everything is working correctly.

Checked live in Chrome:
- **Render, from `hbasired/AI-Hackathon` `main`:** healthy, with AI, an OpenAlex key and saves. All eight test-pack references got the expected labels, with the duplicate banner and the fix offered. Guardrails: "All 10 checks match what the deck says." Its scripts contain every feature of this branch.
- **The team site on Vercel:** it runs `main` without this branch. Reference E came back Details differ, not Wrong paper. F matched a re-posted copy. G was not flagged as a duplicate, and H (the web page) was dropped silently. It has no Check fix buttons and no Guardrails page. Yash would fix this by merging `hemanth/lab-governance` (no conflicts) and deploying.
- **The deploy2 screenshot** is the team site's Evidence page, with the old row "The sentence is in the source, exactly ✓ yes" next to a typed question. This branch already replaced that row with "Your words appear in the source". The text typed in the screenshot was a question, so Evidence now shows a gentle hint that points to Ask (`src/core/claims/shape.ts`). It never changes a label.
- A browser test written before Phase 2 still expected the old Ask heading. It was found and updated, and every browser test file has now run after the Phase 2 changes.
