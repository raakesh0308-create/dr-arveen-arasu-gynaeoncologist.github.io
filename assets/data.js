/*
 * DR ARVEEN — seed content store (prototype).
 * Clinical content is kept here, separate from the interface code.
 *
 * GOVERNANCE NOTE: every record below is a SEED record created during prototyping.
 * None has been verified against its source by a named ARVEEN reviewer, so every
 * record carries status "NOT VERIFIED". Doses, numerical trial outcomes and
 * recommendation grades are deliberately left empty ("not entered") until a
 * reviewer enters them from the authoritative source.
 */
window.ARVEEN_DATA = {
  meta: {
    seedDate: "2026-10-25",
    note: "Prototype seed data. All clinical records are NOT VERIFIED and must be checked against the original source before any clinical use."
  },

  organisations: [
    { id: "ESGO", name: "European Society of Gynaecological Oncology", url: "https://www.esgo.org" },
    { id: "ESTRO", name: "European SocieTy for Radiotherapy and Oncology", url: "https://www.estro.org" },
    { id: "ESP", name: "European Society of Pathology", url: "https://www.esp-pathology.org" },
    { id: "ESMO", name: "European Society for Medical Oncology", url: "https://www.esmo.org/guidelines" },
    { id: "FIGO", name: "International Federation of Gynecology and Obstetrics", url: "https://www.figo.org" },
    { id: "NCCN", name: "National Comprehensive Cancer Network", url: "https://www.nccn.org/guidelines" },
    { id: "ASTRO", name: "American Society for Radiation Oncology", url: "https://www.astro.org" },
    { id: "WHO", name: "World Health Organization", url: "https://www.who.int" },
    { id: "NICE", name: "National Institute for Health and Care Excellence", url: "https://www.nice.org.uk" },
    { id: "RCOG", name: "Royal College of Obstetricians and Gynaecologists", url: "https://www.rcog.org.uk/guidance/" },
    { id: "MOH-MY", name: "Ministry of Health Malaysia", url: "https://www.moh.gov.my" }
  ],

  diseases: [
    { id: "cervical", name: "Cervical cancer", short: "Squamous, adeno- and other carcinomas of the cervix; HPV-associated and HPV-independent types.",
      patient: "Cancer that starts in the cervix, the lower part of the womb that opens into the vagina. Most cervical cancers are linked to a long-lasting infection with high-risk types of human papillomavirus (HPV)." },
    { id: "ovarian", name: "Ovarian cancer", short: "Epithelial (HGSC, LGSC, clear cell, endometrioid, mucinous), germ-cell and sex cord-stromal tumours.",
      patient: "Cancer that starts in the ovaries. Doctors often group it with fallopian tube and primary peritoneal cancer because they behave in similar ways and are treated in similar ways." },
    { id: "tubal", name: "Fallopian tube cancer", short: "Managed with epithelial ovarian cancer pathways in most guidelines.",
      patient: "Cancer that starts in a fallopian tube, the tube that connects an ovary to the womb. It is usually treated in the same way as ovarian cancer." },
    { id: "peritoneal", name: "Primary peritoneal cancer", short: "Serous carcinoma arising from the peritoneum; staged with ovarian cancer.",
      patient: "Cancer that starts in the peritoneum, the thin lining inside the abdomen. It is usually treated in the same way as ovarian cancer." },
    { id: "endometrial", name: "Endometrial cancer", short: "Histotype and molecular class (POLEmut, MMRd, NSMP, p53abn) drive risk grouping.",
      patient: "Cancer that starts in the lining of the womb (the endometrium). The most common early sign is bleeding after the menopause, or unusual bleeding before it." },
    { id: "vulvar", name: "Vulvar cancer", short: "Mostly squamous cell carcinoma; HPV-associated and HPV-independent pathways.",
      patient: "Cancer of the vulva, the outer part of the female genitals. Signs can include itching, soreness, a lump, an ulcer or a change in skin colour that does not go away." },
    { id: "vaginal", name: "Vaginal cancer", short: "Rare primary cancer; exclude secondary spread from cervix, vulva or uterus.",
      patient: "Cancer that starts in the vagina. It is rare. Doctors first check that the cancer has not spread there from somewhere nearby." },
    { id: "sarcoma", name: "Uterine sarcomas", short: "Leiomyosarcoma, endometrial stromal sarcoma (low/high grade), undifferentiated uterine sarcoma, adenosarcoma.",
      patient: "Rare cancers that start in the muscle or supporting tissue of the womb, rather than its lining. They are treated differently from endometrial cancer." },
    { id: "gtn", name: "Gestational trophoblastic neoplasia", short: "Invasive mole, choriocarcinoma, PSTT, ETT; FIGO anatomical stage with prognostic risk score.",
      patient: "Rare conditions that develop from cells that would normally form the placenta in pregnancy. Care is usually coordinated by a specialist centre, and hCG blood tests are used to monitor it." },
    { id: "rare", name: "Rare gynaecological malignancies", short: "Inventory to be expanded systematically (e.g. small-cell neuroendocrine carcinoma of the cervix).",
      patient: "Some gynaecological cancers are very rare. Your specialist team will explain what is known about your type and where specialist advice is available." }
  ],

  guidelines: [
    { id: "G-ESGO-CX-2023", title: "ESGO/ESTRO/ESP Guidelines for the management of patients with cervical cancer – Update 2023",
      org: ["ESGO", "ESTRO", "ESP"], disease: "cervical", domain: ["Diagnosis", "Staging", "Treatment", "Follow-up"], type: "Guideline",
      pubDate: "2023", version: "Update 2023", revisionDate: null, jurisdiction: "Europe", population: "Adults with cervical cancer",
      setting: "Specialist gynaecological oncology", sourceUrl: "https://www.esgo.org", access: "Not verified",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "active", supersedes: "G-ESGO-CX-2018",
      history: [{ v: "2018", note: "First joint ESGO/ESTRO/ESP edition (record not yet created in detail)" }, { v: "Update 2023", note: "Current edition per seed" }],
      summary: "ARVEEN placeholder summary. Covers diagnostic work-up, staging, surgical and radiotherapy management, fertility-sparing treatment, management in pregnancy, recurrent disease and follow-up. Summary to be written from the source by a reviewer.",
      limitations: "European healthcare context. Recommendation grades not yet transcribed." },
    { id: "G-ESGO-CX-2018", title: "ESGO/ESTRO/ESP guidelines for the management of patients with cervical cancer (2018)",
      org: ["ESGO", "ESTRO", "ESP"], disease: "cervical", domain: ["Treatment"], type: "Guideline",
      pubDate: "2018", version: "2018", revisionDate: null, jurisdiction: "Europe", population: "Adults with cervical cancer",
      setting: "Specialist gynaecological oncology", sourceUrl: "https://www.esgo.org", access: "Not verified",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "superseded", supersededBy: "G-ESGO-CX-2023",
      history: [{ v: "2018", note: "Superseded by Update 2023" }], summary: "Retained for version history only.", limitations: "Superseded." },
    { id: "G-ESGO-EN-2021", title: "ESGO/ESTRO/ESP guidelines for the management of patients with endometrial carcinoma",
      org: ["ESGO", "ESTRO", "ESP"], disease: "endometrial", domain: ["Pathology", "Molecular classification", "Treatment"], type: "Guideline",
      pubDate: "2021", version: "2021", revisionDate: null, jurisdiction: "Europe", population: "Adults with endometrial carcinoma",
      setting: "Specialist gynaecological oncology", sourceUrl: "https://www.esgo.org", access: "Not verified",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "uncertain",
      history: [{ v: "2021", note: "Edition in seed. Surveillance flagged a possible newer edition (see Updates)." }],
      summary: "ARVEEN placeholder summary. Introduced integration of molecular classification into risk groups for adjuvant treatment decisions.",
      limitations: "Possible newer edition exists; superseded status uncertain until reviewed." },
    { id: "G-ESMO-OV-2023", title: "Newly diagnosed and relapsed epithelial ovarian cancer: ESMO Clinical Practice Guideline for diagnosis, treatment and follow-up",
      org: ["ESMO"], disease: "ovarian", domain: ["Diagnosis", "Treatment", "Follow-up"], type: "Clinical practice guideline",
      pubDate: "2023", version: "2023", revisionDate: null, jurisdiction: "International (Europe-led)", population: "Adults with epithelial ovarian, tubal or primary peritoneal cancer",
      setting: "Oncology", sourceUrl: "https://www.esmo.org/guidelines", access: "Not verified",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "active",
      history: [{ v: "2023", note: "Edition in seed" }], summary: "ARVEEN placeholder summary. Covers first-line surgery and systemic therapy, maintenance including biomarker-directed PARP inhibition, and relapsed disease.",
      limitations: "Recommendation grades not yet transcribed." },
    { id: "G-ESMOESGO-OV-2019", title: "ESMO–ESGO consensus conference recommendations on ovarian cancer: pathology and molecular biology, early and advanced stages, borderline tumours and recurrent disease",
      org: ["ESMO", "ESGO"], disease: "ovarian", domain: ["Pathology", "Treatment"], type: "Consensus statement",
      pubDate: "2019", version: "2019", revisionDate: null, jurisdiction: "Europe", population: "Adults with ovarian cancer or borderline tumours",
      setting: "Specialist gynaecological oncology", sourceUrl: "https://www.esgo.org", access: "Not verified",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "uncertain",
      history: [{ v: "2019", note: "Edition in seed" }], summary: "ARVEEN placeholder summary.", limitations: "Consensus document, not a systematic-review guideline." },
    { id: "G-ESGO-VU-2023", title: "ESGO guidelines for the management of patients with vulvar cancer – Update 2023",
      org: ["ESGO"], disease: "vulvar", domain: ["Diagnosis", "Treatment", "Follow-up"], type: "Guideline",
      pubDate: "2023", version: "Update 2023", revisionDate: null, jurisdiction: "Europe", population: "Adults with vulvar cancer",
      setting: "Specialist gynaecological oncology", sourceUrl: "https://www.esgo.org", access: "Not verified",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "active",
      history: [{ v: "Update 2023", note: "Edition in seed" }], summary: "ARVEEN placeholder summary.", limitations: "Recommendation grades not yet transcribed." },
    { id: "G-NCCN-CX", title: "NCCN Clinical Practice Guidelines in Oncology: Cervical Cancer",
      org: ["NCCN"], disease: "cervical", domain: ["Diagnosis", "Treatment", "Follow-up"], type: "Guideline (continuously updated)",
      pubDate: null, version: null, revisionDate: null, jurisdiction: "United States", population: "Adults with cervical cancer",
      setting: "Oncology", sourceUrl: "https://www.nccn.org/guidelines", access: "Free registration required (not verified)",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "uncertain",
      history: [], summary: "NCCN issues numbered versions several times a year. No version has been recorded in ARVEEN yet.",
      limitations: "Licensing restricts reproduction; ARVEEN may link and summarise only where permitted." },
    { id: "G-NCCN-OV", title: "NCCN Clinical Practice Guidelines in Oncology: Ovarian Cancer / Fallopian Tube Cancer / Primary Peritoneal Cancer",
      org: ["NCCN"], disease: "ovarian", domain: ["Treatment"], type: "Guideline (continuously updated)",
      pubDate: null, version: null, revisionDate: null, jurisdiction: "United States", population: "Adults with epithelial ovarian, tubal or peritoneal cancer",
      setting: "Oncology", sourceUrl: "https://www.nccn.org/guidelines", access: "Free registration required (not verified)",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "uncertain",
      history: [], summary: "No version recorded yet.", limitations: "Licensing restricts reproduction." },
    { id: "G-NCCN-UT", title: "NCCN Clinical Practice Guidelines in Oncology: Uterine Neoplasms",
      org: ["NCCN"], disease: "endometrial", domain: ["Treatment"], type: "Guideline (continuously updated)",
      pubDate: null, version: null, revisionDate: null, jurisdiction: "United States", population: "Adults with endometrial carcinoma or uterine sarcoma",
      setting: "Oncology", sourceUrl: "https://www.nccn.org/guidelines", access: "Free registration required (not verified)",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "uncertain",
      history: [], summary: "No version recorded yet.", limitations: "Licensing restricts reproduction." },
    { id: "G-ASTRO-CX-2020", title: "Radiation Therapy for Cervical Cancer: An ASTRO Clinical Practice Guideline",
      org: ["ASTRO"], disease: "cervical", domain: ["Radiotherapy", "Brachytherapy"], type: "Clinical practice guideline",
      pubDate: "2020", version: "2020", revisionDate: null, jurisdiction: "United States", population: "Adults receiving radiotherapy for cervical cancer",
      setting: "Radiation oncology", sourceUrl: "https://www.astro.org", access: "Not verified",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "uncertain",
      history: [{ v: "2020", note: "Edition in seed" }], summary: "ARVEEN placeholder summary.", limitations: "Radiotherapy-specific scope." },
    { id: "G-NICE-NG12", title: "Suspected cancer: recognition and referral (NG12)",
      org: ["NICE"], disease: "ovarian", domain: ["Recognition", "Referral"], type: "Guideline",
      pubDate: "2015", version: "Updated edition (date not recorded)", revisionDate: null, jurisdiction: "England and Wales", population: "People presenting in primary care with possible cancer symptoms",
      setting: "Primary care", sourceUrl: "https://www.nice.org.uk/guidance/ng12", access: "Public",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "active",
      history: [{ v: "2015", note: "Original publication; later updates not yet recorded" }], summary: "Covers referral criteria including gynaecological cancer symptoms.", limitations: "NHS referral pathways do not map directly to Malaysian practice." },
    { id: "G-NICE-CG122", title: "Ovarian cancer: recognition and initial management (CG122)",
      org: ["NICE"], disease: "ovarian", domain: ["Recognition", "Initial management"], type: "Guideline",
      pubDate: "2011", version: "2011", revisionDate: null, jurisdiction: "England and Wales", population: "Women with suspected or confirmed ovarian cancer",
      setting: "Primary and secondary care", sourceUrl: "https://www.nice.org.uk/guidance/cg122", access: "Public",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "uncertain",
      history: [{ v: "2011", note: "Edition in seed" }], summary: "ARVEEN placeholder summary.", limitations: "Older guideline; check currency." },
    { id: "G-WHO-CXSCR-2021", title: "WHO guideline for screening and treatment of cervical pre-cancer lesions for cervical cancer prevention, second edition",
      org: ["WHO"], disease: "cervical", domain: ["Screening", "Prevention"], type: "Guideline",
      pubDate: "2021", version: "Second edition", revisionDate: null, jurisdiction: "Global", population: "Women and people with a cervix eligible for screening",
      setting: "Public health / primary care", sourceUrl: "https://www.who.int/publications", access: "Public",
      evidenceFramework: "GRADE (to be confirmed)", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "active",
      history: [{ v: "Second edition", note: "Edition in seed" }], summary: "Screening and pre-cancer treatment; not a cancer-treatment guideline.", limitations: "Prevention scope only." },
    { id: "G-RCOG-GTG38", title: "Management of Gestational Trophoblastic Disease (Green-top Guideline No. 38)",
      org: ["RCOG"], disease: "gtn", domain: ["Diagnosis", "Follow-up"], type: "Guideline",
      pubDate: "2020", version: "Fourth edition (to be confirmed)", revisionDate: null, jurisdiction: "United Kingdom", population: "People with gestational trophoblastic disease",
      setting: "Obstetrics and gynaecology", sourceUrl: "https://www.rcog.org.uk/guidance/", access: "Not verified",
      evidenceFramework: "Not recorded", recFramework: "Not recorded", malaysia: "intl-not-verified",
      verifiedOn: null, reviewer: null, status: "NOT VERIFIED", superseded: "uncertain",
      history: [], summary: "ARVEEN placeholder summary.", limitations: "UK centralised registration and hCG surveillance model." }
  ],

  // Recommendation-level records. Text is an ARVEEN paraphrase pending verification — never a quotation.
  recommendations: [
    { id: "R-CX-001", guideline: "G-ESGO-CX-2023", location: "Section not recorded", disease: "cervical", stage: "Early-stage, surgical candidates",
      histology: "All", biomarker: "Not specified", setting: "Primary surgery", intent: "Curative",
      text: "Open abdominal radical hysterectomy is the preferred surgical approach; the minimally invasive route carries a higher recurrence risk in randomised evidence.",
      textType: "ARVEEN paraphrase", grade: "Not entered", strength: "Not entered", malaysia: "intl-not-verified", trials: ["T-LACC"], protocols: [], status: "NOT VERIFIED" },
    { id: "R-CX-002", guideline: "G-ESGO-CX-2023", location: "Section not recorded", disease: "cervical", stage: "Locally advanced",
      histology: "All", biomarker: "Not specified", setting: "Definitive treatment", intent: "Curative",
      text: "Definitive treatment for locally advanced disease is concurrent platinum-based chemoradiotherapy followed by image-guided brachytherapy.",
      textType: "ARVEEN paraphrase", grade: "Not entered", strength: "Not entered", malaysia: "intl-not-verified", trials: ["T-KN-A18"], protocols: ["P-CX-CRT"], status: "NOT VERIFIED" },
    { id: "R-CX-003", guideline: "G-ESGO-CX-2023", location: "Section not recorded", disease: "cervical", stage: "All stages",
      histology: "All", biomarker: "Not specified", setting: "Work-up", intent: "Diagnostic",
      text: "Pelvic MRI is the preferred imaging test to assess local tumour extent; nodal and distant assessment uses CT or PET-CT according to stage.",
      textType: "ARVEEN paraphrase", grade: "Not entered", strength: "Not entered", malaysia: "intl-not-verified", trials: [], protocols: [], status: "NOT VERIFIED" },
    { id: "R-EN-001", guideline: "G-ESGO-EN-2021", location: "Section not recorded", disease: "endometrial", stage: "All stages",
      histology: "Endometrial carcinoma", biomarker: "POLE, MMR/MSI, p53", setting: "Pathology", intent: "Risk stratification",
      text: "Molecular classification is encouraged for all endometrial carcinomas and is integrated into prognostic risk groups.",
      textType: "ARVEEN paraphrase", grade: "Not entered", strength: "Not entered", malaysia: "intl-not-verified", trials: ["T-PORTEC3"], protocols: [], status: "NOT VERIFIED" },
    { id: "R-OV-001", guideline: "G-ESMO-OV-2023", location: "Section not recorded", disease: "ovarian", stage: "Advanced (FIGO III–IV)",
      histology: "High-grade serous / endometrioid", biomarker: "BRCA1/2, HRD", setting: "First-line maintenance", intent: "Disease control",
      text: "Germline and/or somatic BRCA testing, and HRD testing where available, should inform the choice of first-line maintenance therapy.",
      textType: "ARVEEN paraphrase", grade: "Not entered", strength: "Not entered", malaysia: "intl-not-verified", trials: ["T-SOLO1", "T-PAOLA1", "T-PRIMA"], protocols: ["P-OV-OLA"], status: "NOT VERIFIED" },
    { id: "R-OV-002", guideline: "G-ESMOESGO-OV-2019", location: "Section not recorded", disease: "ovarian", stage: "Advanced",
      histology: "Epithelial", biomarker: "Not specified", setting: "Primary surgery", intent: "Curative / disease control",
      text: "The aim of cytoreductive surgery is complete resection of all macroscopic disease, performed in a specialist centre.",
      textType: "ARVEEN paraphrase", grade: "Not entered", strength: "Not entered", malaysia: "intl-not-verified", trials: ["T-LION"], protocols: [], status: "NOT VERIFIED" }
  ],

  // Staging definitions are ARVEEN educational paraphrases, not the FIGO text. Verify against the FIGO publication.
  staging: [
    { id: "FIGO2018-CX", cancer: "cervical", name: "FIGO staging of cancer of the cervix uteri", authority: "FIGO", version: "2018", superseded: false,
      notes: "Imaging and pathology may be used, where available, to supplement clinical findings. Notation 'r' (imaging) or 'p' (pathology) is added to stage IIIC to show how nodal status was established. Lymphovascular space invasion does not change the stage.",
      stages: [
        { s: "I", d: "Carcinoma strictly confined to the cervix (extension to the uterine corpus is disregarded).", sub: [
          { s: "IA", d: "Invasive carcinoma diagnosed only by microscopy, with maximum depth of invasion less than 5 mm.", sub: [
            { s: "IA1", d: "Measured stromal invasion less than 3 mm in depth." },
            { s: "IA2", d: "Measured stromal invasion of 3 mm or more and less than 5 mm in depth." }]},
          { s: "IB", d: "Invasive carcinoma with measured deepest invasion of 5 mm or more, lesion limited to the cervix.", sub: [
            { s: "IB1", d: "Stromal invasion 5 mm or more and greatest dimension 2 cm or less." },
            { s: "IB2", d: "Greatest dimension more than 2 cm and 4 cm or less." },
            { s: "IB3", d: "Greatest dimension more than 4 cm." }]}]},
        { s: "II", d: "Carcinoma invades beyond the uterus but has not extended onto the lower third of the vagina or to the pelvic wall.", sub: [
          { s: "IIA", d: "Involvement limited to the upper two-thirds of the vagina without parametrial involvement.", sub: [
            { s: "IIA1", d: "Greatest dimension 4 cm or less." },
            { s: "IIA2", d: "Greatest dimension more than 4 cm." }]},
          { s: "IIB", d: "Parametrial involvement, not up to the pelvic wall." }]},
        { s: "III", d: "Involves the lower third of the vagina and/or extends to the pelvic wall and/or causes hydronephrosis or a non-functioning kidney and/or involves pelvic and/or para-aortic lymph nodes.", sub: [
          { s: "IIIA", d: "Involves the lower third of the vagina, without extension to the pelvic wall." },
          { s: "IIIB", d: "Extension to the pelvic wall and/or hydronephrosis or non-functioning kidney (unless known to be due to another cause)." },
          { s: "IIIC", d: "Involvement of pelvic and/or para-aortic lymph nodes, irrespective of tumour size and extent (with r or p notation).", sub: [
            { s: "IIIC1", d: "Pelvic lymph node metastasis only." },
            { s: "IIIC2", d: "Para-aortic lymph node metastasis." }]}]},
        { s: "IV", d: "Extends beyond the true pelvis or involves (biopsy-proven) the mucosa of the bladder or rectum. Bullous oedema alone does not qualify.", sub: [
          { s: "IVA", d: "Spread to adjacent pelvic organs." },
          { s: "IVB", d: "Spread to distant organs." }]}
      ]},
    { id: "FIGO2023-EN", cancer: "endometrial", name: "FIGO staging of endometrial cancer", authority: "FIGO", version: "2023", superseded: false,
      notes: "Introduces histological type, LVSI extent and molecular classification. Where molecular classification is known, POLE-mutated tumours confined to the uterus are staged IAmPOLEmut, and p53-abnormal tumours with myometrial invasion confined to the uterus are staged IICmp53abn. 'Non-aggressive' broadly means low-grade endometrioid; 'aggressive' includes high-grade endometrioid, serous, clear cell, carcinosarcoma, undifferentiated and mixed types.",
      stages: [
        { s: "I", d: "Confined to the uterine corpus and ovary.", sub: [
          { s: "IA", d: "Disease limited to the endometrium, or non-aggressive type with less than half myometrial invasion and no or focal LVSI, or good-prognosis disease.", sub: [
            { s: "IA1", d: "Non-aggressive type limited to an endometrial polyp or confined to the endometrium." },
            { s: "IA2", d: "Non-aggressive type involving less than half of the myometrium with no or focal LVSI." },
            { s: "IA3", d: "Low-grade endometrioid carcinoma limited to the uterus and ovary (meeting defined criteria)." }]},
          { s: "IB", d: "Non-aggressive type with invasion of half or more of the myometrium, and no or focal LVSI." },
          { s: "IC", d: "Aggressive type limited to a polyp or confined to the endometrium." }]},
        { s: "II", d: "Invasion of cervical stroma without extrauterine extension, or substantial LVSI, or aggressive type with myometrial invasion.", sub: [
          { s: "IIA", d: "Cervical stromal invasion by a non-aggressive type." },
          { s: "IIB", d: "Substantial LVSI in a non-aggressive type." },
          { s: "IIC", d: "Aggressive type with any myometrial involvement." }]},
        { s: "III", d: "Local and/or regional spread of any histological type.", sub: [
          { s: "IIIA", d: "Invasion of uterine serosa, adnexa, or both.", sub: [
            { s: "IIIA1", d: "Spread to ovary or fallopian tube (except when stage IA3 criteria are met)." },
            { s: "IIIA2", d: "Involvement of uterine subserosa or spread through the uterine serosa." }]},
          { s: "IIIB", d: "Spread to vagina and/or parametria, or pelvic peritoneum.", sub: [
            { s: "IIIB1", d: "Vagina and/or parametria." },
            { s: "IIIB2", d: "Pelvic peritoneum." }]},
          { s: "IIIC", d: "Pelvic and/or para-aortic lymph node metastasis (micrometastasis 'i', macrometastasis 'ii').", sub: [
            { s: "IIIC1", d: "Pelvic nodes." },
            { s: "IIIC2", d: "Para-aortic nodes up to the renal vessels, with or without pelvic nodes." }]}]},
        { s: "IV", d: "Spread to bladder and/or bowel mucosa and/or distant metastasis.", sub: [
          { s: "IVA", d: "Invasion of bladder and/or bowel mucosa." },
          { s: "IVB", d: "Abdominal peritoneal metastasis beyond the pelvis." },
          { s: "IVC", d: "Distant metastasis, including lymph nodes above the renal vessels, lung, liver, brain or bone." }]}
      ]},
    { id: "FIGO2014-OV", cancer: "ovarian", name: "FIGO staging of cancer of the ovary, fallopian tube and peritoneum", authority: "FIGO", version: "2014", superseded: false,
      notes: "Applies to ovarian, fallopian tube and primary peritoneal cancer. Histological type should be recorded.",
      stages: [
        { s: "I", d: "Tumour confined to ovaries or fallopian tube(s).", sub: [
          { s: "IA", d: "One ovary or tube; capsule intact, no tumour on the surface, negative washings." },
          { s: "IB", d: "Both ovaries or tubes; otherwise as IA." },
          { s: "IC", d: "One or both ovaries or tubes, with any of the following:", sub: [
            { s: "IC1", d: "Surgical spill." },
            { s: "IC2", d: "Capsule ruptured before surgery, or tumour on ovarian or tubal surface." },
            { s: "IC3", d: "Malignant cells in ascites or peritoneal washings." }]}]},
        { s: "II", d: "One or both ovaries or tubes with pelvic extension below the pelvic brim, or primary peritoneal cancer.", sub: [
          { s: "IIA", d: "Extension and/or implants on the uterus and/or tubes and/or ovaries." },
          { s: "IIB", d: "Extension to other pelvic intraperitoneal tissues." }]},
        { s: "III", d: "Spread to the peritoneum outside the pelvis and/or metastasis to retroperitoneal lymph nodes.", sub: [
          { s: "IIIA1", d: "Positive retroperitoneal lymph nodes only (IIIA1(i) up to 10 mm; IIIA1(ii) more than 10 mm)." },
          { s: "IIIA2", d: "Microscopic extrapelvic peritoneal involvement, with or without positive retroperitoneal nodes." },
          { s: "IIIB", d: "Macroscopic peritoneal metastasis beyond the pelvis, 2 cm or less, with or without positive nodes." },
          { s: "IIIC", d: "Macroscopic peritoneal metastasis beyond the pelvis, more than 2 cm, with or without positive nodes (includes capsule of liver and spleen without parenchymal involvement)." }]},
        { s: "IV", d: "Distant metastasis excluding peritoneal metastases.", sub: [
          { s: "IVA", d: "Pleural effusion with positive cytology." },
          { s: "IVB", d: "Parenchymal metastases and metastases to extra-abdominal organs, including inguinal nodes and nodes outside the abdominal cavity." }]}
      ]},
    { id: "FIGO2009-EN", cancer: "endometrial", name: "FIGO staging of endometrial cancer", authority: "FIGO", version: "2009", superseded: true, supersededBy: "FIGO2023-EN",
      notes: "Superseded by FIGO 2023. Kept so that older pathology reports and trial populations can be interpreted. Detailed criteria not entered.", stages: [] }
  ],

  protocols: [
    { id: "P-OV-CP3W", name: "Carboplatin + paclitaxel, 3-weekly", indication: "First-line systemic treatment, epithelial ovarian / tubal / peritoneal cancer",
      disease: "ovarian", histology: "Epithelial", stage: "Not entered", intent: "Curative / disease control", line: "First line", biomarker: "None required",
      modality: "Chemotherapy", sourceType: "No authoritative protocol source linked",
      components: [ { drug: "carboplatin", basis: "AUC (Calvert formula)", dose: null, route: "IV", schedule: null },
                    { drug: "paclitaxel", basis: "mg/m² (BSA)", dose: null, route: "IV", schedule: null } ],
      cycle: "21 days (per regimen name; confirm with source)", duration: null, malaysia: "availability", status: "NOT VERIFIED", labels: [] },
    { id: "P-CX-CRT", name: "Weekly cisplatin with pelvic radiotherapy, followed by brachytherapy", indication: "Definitive chemoradiotherapy, locally advanced cervical cancer",
      disease: "cervical", histology: "All", stage: "Locally advanced", intent: "Curative", line: "Definitive", biomarker: "None required",
      modality: "Chemoradiotherapy", sourceType: "No authoritative protocol source linked",
      components: [ { drug: "cisplatin", basis: "mg/m² (BSA)", dose: null, route: "IV", schedule: null } ],
      cycle: "Weekly during external beam radiotherapy (confirm with source)", duration: null, malaysia: "availability", status: "NOT VERIFIED", labels: [] },
    { id: "P-EN-CP-PEMBRO", name: "Carboplatin + paclitaxel + pembrolizumab", indication: "Advanced or recurrent endometrial carcinoma",
      disease: "endometrial", histology: "Endometrial carcinoma", stage: "Advanced / recurrent", intent: "Disease control", line: "First line", biomarker: "MMR/MSI status to be recorded",
      modality: "Chemo-immunotherapy", sourceType: "Trial publication only (NRG-GY018) — an institutional protocol cannot be inferred from it",
      components: [ { drug: "carboplatin", basis: "AUC (Calvert formula)", dose: null, route: "IV", schedule: null },
                    { drug: "paclitaxel", basis: "mg/m² (BSA)", dose: null, route: "IV", schedule: null },
                    { drug: "pembrolizumab", basis: "Flat dose", dose: null, route: "IV", schedule: null } ],
      cycle: null, duration: null, malaysia: "regulatory", status: "NOT VERIFIED", labels: ["Trial-derived"] },
    { id: "P-OV-OLA", name: "Olaparib maintenance", indication: "First-line maintenance after response to platinum, BRCA-mutated advanced ovarian cancer",
      disease: "ovarian", histology: "High-grade serous / endometrioid", stage: "Advanced", intent: "Maintenance", line: "First-line maintenance", biomarker: "BRCA1/2 pathogenic variant (germline or somatic)",
      modality: "PARP inhibitor", sourceType: "No authoritative protocol source linked",
      components: [ { drug: "olaparib", basis: "Flat oral dose", dose: null, route: "Oral", schedule: null } ],
      cycle: "Continuous", duration: null, malaysia: "regulatory", status: "NOT VERIFIED", labels: [] },
    { id: "P-GTN-MTX", name: "Single-agent methotrexate", indication: "Low-risk gestational trophoblastic neoplasia",
      disease: "gtn", histology: "GTN", stage: "Low risk (prognostic score)", intent: "Curative", line: "First line", biomarker: "Not applicable (hCG monitoring)",
      modality: "Chemotherapy", sourceType: "Several distinct schedules exist; do not combine rules between them",
      components: [ { drug: "methotrexate", basis: "Schedule-dependent", dose: null, route: "IM / IV (schedule-dependent)", schedule: null } ],
      cycle: null, duration: "Until hCG normalisation plus consolidation (per source protocol)", malaysia: "availability", status: "NOT VERIFIED", labels: [] }
  ],

  // Drug monographs — ARVEEN educational summaries, not product information. Doses deliberately not entered.
  drugs: [
    { id: "carboplatin", name: "Carboplatin", cls: "Platinum compound", moa: "Forms platinum–DNA crosslinks that block DNA replication.", cancers: ["ovarian", "endometrial", "cervical"], ae: "Myelosuppression (notably thrombocytopenia), nausea, hypersensitivity reactions (risk rises with repeated exposure).", renal: "Dose is usually derived from renal function (Calvert formula).", npra: "Not verified" },
    { id: "cisplatin", name: "Cisplatin", cls: "Platinum compound", moa: "Forms platinum–DNA crosslinks; radiosensitising.", cancers: ["cervical"], ae: "Nephrotoxicity, ototoxicity, peripheral neuropathy, highly emetogenic, electrolyte loss (magnesium).", renal: "Requires renal function assessment and hydration per protocol.", npra: "Not verified" },
    { id: "paclitaxel", name: "Paclitaxel", cls: "Taxane", moa: "Stabilises microtubules, arresting mitosis.", cancers: ["ovarian", "endometrial", "cervical"], ae: "Peripheral neuropathy, neutropenia, alopecia, hypersensitivity reactions (premedication used), myalgia.", renal: "Not entered.", npra: "Not verified" },
    { id: "olaparib", name: "Olaparib", cls: "PARP inhibitor", moa: "Inhibits PARP enzymes; synthetic lethality in homologous-recombination-deficient tumours.", cancers: ["ovarian"], ae: "Anaemia, nausea, fatigue; rare myelodysplastic syndrome / acute myeloid leukaemia.", renal: "Not entered.", npra: "Not verified" },
    { id: "niraparib", name: "Niraparib", cls: "PARP inhibitor", moa: "Inhibits PARP-1 and PARP-2.", cancers: ["ovarian"], ae: "Thrombocytopenia, anaemia, hypertension, fatigue, nausea.", renal: "Not entered.", npra: "Not verified" },
    { id: "bevacizumab", name: "Bevacizumab", cls: "Anti-VEGF-A monoclonal antibody", moa: "Binds VEGF-A, inhibiting tumour angiogenesis.", cancers: ["ovarian", "cervical"], ae: "Hypertension, proteinuria, bleeding, thromboembolism, impaired wound healing, gastrointestinal perforation or fistula.", renal: "Monitor for proteinuria.", npra: "Not verified" },
    { id: "pembrolizumab", name: "Pembrolizumab", cls: "Anti-PD-1 monoclonal antibody (immune checkpoint inhibitor)", moa: "Blocks PD-1, restoring T-cell anti-tumour activity.", cancers: ["cervical", "endometrial"], ae: "Immune-related adverse events affecting any organ (e.g. colitis, pneumonitis, hepatitis, endocrinopathies, skin); may occur after treatment ends.", renal: "Not entered.", npra: "Not verified" },
    { id: "dostarlimab", name: "Dostarlimab", cls: "Anti-PD-1 monoclonal antibody (immune checkpoint inhibitor)", moa: "Blocks PD-1.", cancers: ["endometrial"], ae: "Immune-related adverse events, as for other PD-1 inhibitors.", renal: "Not entered.", npra: "Not verified" },
    { id: "letrozole", name: "Letrozole", cls: "Aromatase inhibitor", moa: "Reduces oestrogen synthesis.", cancers: ["endometrial", "ovarian", "sarcoma"], ae: "Hot flushes, arthralgia, bone density loss, fatigue.", renal: "Not entered.", npra: "Not verified" },
    { id: "mpa", name: "Medroxyprogesterone acetate", cls: "Progestogen", moa: "Progestogenic effect on hormone-receptor-positive endometrial tissue.", cancers: ["endometrial"], ae: "Weight gain, fluid retention, thromboembolism.", renal: "Not entered.", npra: "Not verified" },
    { id: "methotrexate", name: "Methotrexate", cls: "Antimetabolite (antifolate)", moa: "Inhibits dihydrofolate reductase.", cancers: ["gtn"], ae: "Mucositis, myelosuppression, hepatotoxicity, rash, serositis-type pain.", renal: "Renally cleared; renal function matters.", npra: "Not verified" },
    { id: "dactinomycin", name: "Dactinomycin (actinomycin D)", cls: "Cytotoxic antibiotic", moa: "Intercalates DNA, inhibiting RNA synthesis.", cancers: ["gtn"], ae: "Myelosuppression, nausea, mucositis, alopecia; vesicant.", renal: "Not entered.", npra: "Not verified" }
  ],

  // Trial records. Numerical outcomes intentionally not entered until verified against the full publication.
  trials: [
    { id: "T-SOLO1", name: "SOLO-1", reg: "NCT01844986", disease: "ovarian", phase: "III", design: "Randomised, double-blind, placebo-controlled", population: "Newly diagnosed advanced high-grade serous or endometrioid ovarian cancer with BRCA1/2 mutation, in response to platinum chemotherapy", intervention: "Olaparib maintenance", comparator: "Placebo", primary: "Progression-free survival", pub: "N Engl J Med, 2018 (primary report; to be confirmed)", pubType: "Full publication" },
    { id: "T-PAOLA1", name: "PAOLA-1", reg: "NCT02477644", disease: "ovarian", phase: "III", design: "Randomised, double-blind, placebo-controlled", population: "Newly diagnosed advanced ovarian cancer responding to platinum–taxane plus bevacizumab", intervention: "Olaparib + bevacizumab maintenance", comparator: "Placebo + bevacizumab", primary: "Progression-free survival", pub: "N Engl J Med, 2019 (to be confirmed)", pubType: "Full publication" },
    { id: "T-PRIMA", name: "PRIMA", reg: "NCT02655016", disease: "ovarian", phase: "III", design: "Randomised, double-blind, placebo-controlled", population: "Newly diagnosed advanced ovarian cancer responding to first-line platinum, regardless of biomarker status", intervention: "Niraparib maintenance", comparator: "Placebo", primary: "Progression-free survival (HRD population, then overall)", pub: "N Engl J Med, 2019 (to be confirmed)", pubType: "Full publication" },
    { id: "T-LION", name: "LION", reg: "NCT00712218", disease: "ovarian", phase: "III", design: "Randomised", population: "Advanced ovarian cancer, macroscopically complete resection, clinically negative nodes", intervention: "Systematic pelvic and para-aortic lymphadenectomy", comparator: "No lymphadenectomy", primary: "Overall survival", pub: "N Engl J Med, 2019 (to be confirmed)", pubType: "Full publication" },
    { id: "T-DESKTOP3", name: "DESKTOP III", reg: "NCT01166737", disease: "ovarian", phase: "III", design: "Randomised", population: "First platinum-sensitive relapse with positive AGO score", intervention: "Secondary cytoreductive surgery then chemotherapy", comparator: "Chemotherapy alone", primary: "Overall survival", pub: "N Engl J Med, 2021 (to be confirmed)", pubType: "Full publication" },
    { id: "T-LACC", name: "LACC", reg: "NCT00614211", disease: "cervical", phase: "III", design: "Randomised, non-inferiority", population: "Early-stage cervical cancer for radical hysterectomy", intervention: "Minimally invasive radical hysterectomy", comparator: "Open abdominal radical hysterectomy", primary: "Disease-free survival", pub: "N Engl J Med, 2018 (to be confirmed)", pubType: "Full publication" },
    { id: "T-SHAPE", name: "SHAPE", reg: "NCT01658930", disease: "cervical", phase: "III", design: "Randomised, non-inferiority", population: "Low-risk early-stage cervical cancer", intervention: "Simple hysterectomy", comparator: "Radical hysterectomy", primary: "Pelvic recurrence", pub: "N Engl J Med, 2024 (to be confirmed)", pubType: "Full publication" },
    { id: "T-GOG240", name: "GOG-240", reg: "NCT00803062", disease: "cervical", phase: "III", design: "Randomised, 2×2 factorial", population: "Persistent, recurrent or metastatic cervical cancer", intervention: "Chemotherapy + bevacizumab", comparator: "Chemotherapy alone", primary: "Overall survival", pub: "N Engl J Med, 2014 (to be confirmed)", pubType: "Full publication" },
    { id: "T-KN826", name: "KEYNOTE-826", reg: "NCT03635567", disease: "cervical", phase: "III", design: "Randomised, double-blind, placebo-controlled", population: "Persistent, recurrent or metastatic cervical cancer", intervention: "Pembrolizumab + platinum-based chemotherapy ± bevacizumab", comparator: "Placebo + chemotherapy ± bevacizumab", primary: "Progression-free survival and overall survival", pub: "N Engl J Med, 2021 (to be confirmed)", pubType: "Full publication" },
    { id: "T-KN-A18", name: "KEYNOTE-A18", reg: "NCT04221945", disease: "cervical", phase: "III", design: "Randomised, double-blind, placebo-controlled", population: "High-risk locally advanced cervical cancer", intervention: "Pembrolizumab + chemoradiotherapy", comparator: "Placebo + chemoradiotherapy", primary: "Progression-free survival and overall survival", pub: "Not recorded", pubType: "Not recorded" },
    { id: "T-RUBY", name: "RUBY (Part 1)", reg: "NCT03981796", disease: "endometrial", phase: "III", design: "Randomised, double-blind, placebo-controlled", population: "Primary advanced or recurrent endometrial cancer", intervention: "Dostarlimab + carboplatin–paclitaxel", comparator: "Placebo + carboplatin–paclitaxel", primary: "Progression-free survival and overall survival", pub: "N Engl J Med, 2023 (to be confirmed)", pubType: "Full publication" },
    { id: "T-GY018", name: "NRG-GY018", reg: "NCT03914612", disease: "endometrial", phase: "III", design: "Randomised, double-blind, placebo-controlled", population: "Measurable stage III/IVA or IVB/recurrent endometrial cancer, dMMR and pMMR cohorts", intervention: "Pembrolizumab + carboplatin–paclitaxel", comparator: "Placebo + carboplatin–paclitaxel", primary: "Progression-free survival", pub: "N Engl J Med, 2023 (to be confirmed)", pubType: "Full publication" },
    { id: "T-PORTEC3", name: "PORTEC-3", reg: "Not recorded", disease: "endometrial", phase: "III", design: "Randomised", population: "High-risk endometrial cancer", intervention: "Chemoradiotherapy then adjuvant chemotherapy", comparator: "Pelvic radiotherapy alone", primary: "Overall survival and failure-free survival", pub: "Lancet Oncol (primary report year to be confirmed)", pubType: "Full publication" }
  ],

  updates: [
    { id: "U-001", target: "FIGO2023-EN", title: "FIGO endometrial cancer staging revised (2009 → 2023)", org: "FIGO", prev: "2009", next: "2023", pubDate: "2023", detected: null, verifiedOn: null,
      state: "DETECTED", significance: "High", summary: "New staging adds histological type, LVSI extent and molecular classification.",
      affected: ["Staging: FIGO 2023 endometrial", "Disease page: Endometrial cancer", "Patient: understanding staging"], reviewer: null },
    { id: "U-002", target: "G-ESGO-CX-2023", title: "ESGO/ESTRO/ESP cervical cancer guideline updated (2018 → Update 2023)", org: "ESGO / ESTRO / ESP", prev: "2018", next: "Update 2023", pubDate: "2023", detected: null, verifiedOn: null,
      state: "DETECTED", significance: "High", summary: "Change summary not yet written from the source.",
      affected: ["Guideline: G-ESGO-CX-2023", "Recommendations R-CX-001–003", "Leaflet: Understanding Cervical Cancer"], reviewer: null },
    { id: "U-003", target: "G-ESGO-EN-2021", title: "Possible newer edition of ESGO/ESTRO/ESP endometrial guideline", org: "ESGO / ESTRO / ESP", prev: "2021", next: "Not confirmed", pubDate: null, detected: null, verifiedOn: null,
      state: "DETECTED", significance: "Unknown until reviewed", summary: "Surveillance flag only. Edition, date and content have not been confirmed. Approved content is not changed by this flag.",
      affected: ["Guideline: G-ESGO-EN-2021", "Recommendation R-EN-001"], reviewer: null },
    { id: "U-004", target: null, title: "Source search: Malaysian MOH guidance for gynaecological cancers", org: "MOH Malaysia", prev: null, next: null, pubDate: null, detected: null, verifiedOn: null,
      state: "SEARCH TASK", significance: "High (local applicability layer)", summary: "No Malaysian MOH clinical practice guideline for gynaecological cancers has been entered yet. A reviewer must identify, retrieve and record any that exist before 'Established in Malaysian guidance' can be used.",
      affected: ["All Malaysian applicability labels"], reviewer: null }
  ],

  algorithms: [
    { id: "A-CX-WORKUP", title: "Cervical cancer: staging work-up after histological diagnosis", disease: "cervical", source: "G-ESGO-CX-2023", status: "NOT VERIFIED",
      entry: "Histologically confirmed invasive cervical carcinoma.",
      nodes: {
        start: { q: "Is invasive carcinoma confirmed on histology (biopsy or excision)?", options: [["Yes", "lesion"], ["No / not yet", "x-biopsy"], ["Unknown", "missing-histology"]] },
        "x-biopsy": { end: "Obtain diagnostic histology before staging. Refer for colposcopy and biopsy per local pathway.", kind: "escalate" },
        "missing-histology": { end: "Missing information: histological confirmation. The pathway cannot proceed without it.", kind: "missing" },
        lesion: { q: "Is the tumour visible clinically, or only seen on microscopy (e.g. after cone excision)?", options: [["Microscopic only", "micro"], ["Clinically visible", "imaging"], ["Unknown", "missing-lesion"]] },
        "missing-lesion": { end: "Missing information: clinical examination findings. Record examination (with or without anaesthesia) before assigning a stage.", kind: "missing" },
        micro: { end: "Stage depends on measured depth of invasion and margin status on the excision specimen (FIGO 2018 IA1/IA2 or higher). Specialist pathology review and MDT discussion. See Staging → FIGO 2018 cervix.", kind: "info" },
        imaging: { q: "Has pelvic MRI been performed to assess local extent?", options: [["Yes", "nodes"], ["No", "x-mri"]] },
        "x-mri": { end: "Arrange pelvic MRI for local extent (see R-CX-003). Then return to this pathway.", kind: "action" },
        nodes: { q: "Has nodal and distant assessment (CT or PET-CT per stage) been completed?", options: [["Yes", "mdt"], ["No", "x-nodes"]] },
        "x-nodes": { end: "Complete nodal and distant assessment with the modality the source guideline specifies for the suspected stage.", kind: "action" },
        mdt: { end: "Assign FIGO 2018 stage (with r/p notation for IIIC) and present at the gynaecological oncology MDT. Treatment selection is outside this pathway.", kind: "info" }
      }}
  ],

  quiz: [
    { id: "Q1", system: "FIGO2018-CX", q: "A visible cervical tumour measures 3.5 cm and is confined to the cervix. Imaging shows no nodal disease. What is the FIGO 2018 stage?", options: ["IB1", "IB2", "IB3", "IIA1"], answer: 1, why: "IB2 covers tumours confined to the cervix of more than 2 cm and up to 4 cm. IB1 is 2 cm or less; IB3 is more than 4 cm; IIA1 requires upper vaginal involvement." },
    { id: "Q2", system: "FIGO2018-CX", q: "A 3 cm cervical tumour is confined to the cervix, but PET-CT shows an FDG-avid para-aortic node (not biopsied). What is the FIGO 2018 stage?", options: ["IB2", "IIIC1r", "IIIC2r", "IVB"], answer: 2, why: "Para-aortic nodal involvement is IIIC2, irrespective of tumour size. The 'r' records that nodal status was assigned from imaging. Biopsy-confirmed nodes would be 'p'." },
    { id: "Q3", system: "FIGO2014-OV", q: "High-grade serous carcinoma is confined to one ovary, with tumour on the ovarian surface. Washings are negative. What is the FIGO 2014 stage?", options: ["IA", "IC1", "IC2", "IC3"], answer: 2, why: "Surface tumour, or capsule rupture before surgery, is IC2. IC1 is surgical spill; IC3 is malignant cells in ascites or washings." },
    { id: "Q4", system: "FIGO2023-EN", q: "Low-grade endometrioid carcinoma invades less than half the myometrium with no LVSI. What is the FIGO 2023 stage (molecular class unknown)?", options: ["IA1", "IA2", "IB", "IIB"], answer: 1, why: "Non-aggressive histology with less than half myometrial invasion and no or focal LVSI is IA2. IA1 is limited to a polyp or the endometrium." }
  ],

  glossary: [
    ["Biopsy", "Removing a small piece of tissue so it can be looked at under a microscope."],
    ["Brachytherapy", "Radiotherapy given from a source placed inside the body, close to the cancer."],
    ["Chemoradiotherapy", "Chemotherapy and radiotherapy given during the same period, so the chemotherapy makes the radiotherapy work better."],
    ["Colposcopy", "A close look at the cervix using a magnifying instrument (a colposcope)."],
    ["CT scan", "A scan that uses X-rays to make detailed pictures of the inside of the body."],
    ["FIGO stage", "An international system that describes how far a gynaecological cancer has spread."],
    ["HPV", "Human papillomavirus. A common virus. Long-lasting infection with some types can lead to cervical cancer."],
    ["Hysterectomy", "An operation to remove the womb (uterus)."],
    ["Immunotherapy", "Treatment that helps the body's immune system recognise and attack cancer cells."],
    ["Lymph nodes", "Small glands that are part of the immune system. Cancer can sometimes spread to them."],
    ["MDT", "Multidisciplinary team. The group of specialists who meet to plan your care together."],
    ["MRI scan", "A scan that uses magnets and radio waves to make detailed pictures, especially of soft tissues."],
    ["Oncologist", "A doctor who specialises in treating cancer."],
    ["PARP inhibitor", "A tablet treatment that stops cancer cells repairing their DNA. Used for some ovarian cancers."],
    ["Pathology", "The study of tissue samples in a laboratory to find out what kind of cells are present."],
    ["Recurrence", "When cancer comes back after treatment."],
    ["Sentinel lymph node", "The first lymph node (or nodes) that a cancer is most likely to drain to."],
    ["Tumour marker", "A substance in the blood (such as CA-125 or hCG) that can be raised with some cancers."]
  ],

  leaflets: [
    { id: "PIL-CX-001", title: "Understanding Cervical Cancer", disease: "cervical", audience: "Adults with a new diagnosis of cervical cancer, and their families",
      author: "DR ARVEEN editorial team (prototype)", reviewer: null, pubDate: null, lastReview: null, nextReview: null, version: "0.1 draft",
      jurisdiction: "Malaysia", language: "English", translation: "Bahasa Malaysia, Mandarin and Tamil versions not started", approval: "DRAFT",
      sources: ["G-ESGO-CX-2023", "FIGO2018-CX"],
      sections: [
        ["At a glance", ["Cervical cancer starts in the cervix, the lower part of the womb.", "Most cervical cancers are linked to long-lasting HPV infection.", "Treatment depends on the stage of the cancer, your general health and what matters to you.", "Your treating team is your main source of advice. Contact details: [treating team contact — to be added by your hospital]."]],
        ["What is it?", ["The cervix is the neck of the womb. It connects the womb to the vagina.", "Cancer happens when cells in the cervix grow out of control. A doctor confirms it by taking a biopsy (a small tissue sample) and looking at it under a microscope."]],
        ["Why are more tests needed?", ["After diagnosis, scans such as an MRI or CT scan show the size of the cancer and whether it has spread.", "The results give your cancer a stage. The stage helps your team plan the treatment that fits you."]],
        ["What treatments might be offered?", ["Surgery, radiotherapy, chemotherapy, or a combination. Some people are offered immunotherapy.", "Not every treatment is right for every person. Your team will explain why they suggest a particular plan and what the alternatives are.", "You can ask about clinical trials."]],
        ["Benefits and limitations", ["Treatment aims and expected benefits differ between people. Ask your team what the aim of your treatment is.", "This leaflet cannot tell you what will happen to you personally."]],
        ["Risks and side effects", ["Each treatment has its own side effects. Your team will give you information specific to your treatment.", "Some effects, such as changes to fertility, menopause or bladder and bowel function, can be long-term. Ask about them before treatment starts."]],
        ["How can I prepare?", ["Bring a list of your medicines to appointments.", "Think about who can come with you and help with transport.", "If having children in future matters to you, ask about fertility before treatment starts."]]
      ],
      safety: {
        emergency: ["Heavy vaginal bleeding that will not stop", "Severe difficulty breathing or chest pain", "Collapse or becoming unresponsive"],
        urgent: ["Fever, or feeling hot and shivery, during chemotherapy", "New severe pain", "Being unable to pass urine"],
        routine: ["Questions about your results", "Mild tiredness", "Worries about work, money or family"],
        note: "Draft. Thresholds and wording require clinical review before publication. In Malaysia, call 999 in an emergency."
      },
      questions: ["What stage is my cancer, and what does that mean for me?", "What is the aim of the treatment you recommend?", "What other options do I have?", "How will treatment affect my fertility or bring on menopause?", "Who do I call about side effects, day and night?"]
    },
    { id: "PIL-TX-CHEMO", title: "Understanding Chemotherapy", disease: null, audience: "Adults starting chemotherapy for a gynaecological cancer", author: "Not assigned", reviewer: null, version: "Not started", approval: "NOT STARTED", sections: [] },
    { id: "PIL-TX-RT", title: "Preparing for Radiotherapy", disease: null, audience: "Adults starting pelvic radiotherapy", author: "Not assigned", reviewer: null, version: "Not started", approval: "NOT STARTED", sections: [] },
    { id: "PIL-TX-BT", title: "Understanding Brachytherapy", disease: "cervical", audience: "Adults having brachytherapy", author: "Not assigned", reviewer: null, version: "Not started", approval: "NOT STARTED", sections: [] },
    { id: "PIL-SX-HYST", title: "Having a Hysterectomy for Gynaecological Cancer", disease: null, audience: "Adults having a hysterectomy", author: "Not assigned", reviewer: null, version: "Not started", approval: "NOT STARTED", sections: [] },
    { id: "PIL-OV-001", title: "Understanding Ovarian Cancer", disease: "ovarian", audience: "Adults with a new diagnosis of ovarian cancer", author: "Not assigned", reviewer: null, version: "Not started", approval: "NOT STARTED", sections: [] },
    { id: "PIL-TX-IO", title: "Understanding Immunotherapy", disease: null, audience: "Adults starting immunotherapy", author: "Not assigned", reviewer: null, version: "Not started", approval: "NOT STARTED", sections: [] }
  ],

  sdmQuestions: [
    "What type of cancer do I have, and what stage is it?",
    "What did my pathology and biomarker results show?",
    "What is the aim of the treatment you recommend?",
    "What are the other options, including not having treatment now?",
    "What are the likely side effects, and which are serious?",
    "How will treatment affect my fertility, menopause or sex life?",
    "Is there a clinical trial I could join?",
    "How often will I have check-ups, and what tests will they include?",
    "Who do I contact about side effects, and at what times?"
  ]
};
