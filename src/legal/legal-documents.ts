import { createHash } from "node:crypto";

export type LegalLanguage = "ro" | "en";

type LegalDocumentSource = {
  id: string;
  version: string;
  title: Record<LegalLanguage, string>;
  body: Record<LegalLanguage, string>;
};

// New PINLEND drafts adapted from the Pinfers source documents. A change to
// either language changes the hash and therefore requires fresh acceptance.
const sources: LegalDocumentSource[] = [
  {
    id: "user-terms",
    version: "2026-10-04.1",
    title: {
      ro: "Termeni și condiții PINLEND",
      en: "PINLEND Terms and Conditions",
    },
    body: {
      ro: `Data actualizării: 4 octombrie 2026

1. Operatorul platformei
PINLEND este o aplicație operată de PINFERS SRL, Sat Poieni, Str. Mihai Eminescu nr. 165, cod poștal 707441, județul Iași, România, CUI 54788871, Nr. Reg. Com. J2026035406002, EUID ROONRC.J2026035406002. Contact: support@pinfers.com. Website: www.pinfers.ro.

2. Ce oferă PINLEND
Platforma permite publicarea și căutarea de anunțuri pentru închirierea de bunuri și proprietăți, solicitarea și administrarea închirierilor, programarea vizionărilor acolo unde sunt disponibile, mesageria dintre utilizatori, plățile, verificarea identității și gestionarea returnării. Funcțiile disponibile pot diferi după categoria anunțului.

3. Rolurile utilizatorilor
Persoana care publică un anunț este responsabilă pentru dreptul de a oferi bunul, descrierea, starea, prețul, garanția, disponibilitatea și predarea lui. Persoana care închiriază trebuie să folosească bunul conform condițiilor acceptate și să îl returneze la timp și în starea convenită, ținând cont de uzura normală. Contractul de închiriere se încheie între acești utilizatori, conform detaliilor confirmate în aplicație. PINFERS SRL furnizează platforma și rămâne responsabilă pentru serviciile sale digitale potrivit legii.

4. Contul și anunțurile
Furnizezi date reale, păstrezi confidențialitatea contului și poți publica numai anunțuri legale, corecte și actuale pentru bunuri asupra cărora ai drepturile necesare. Nu publica bunuri interzise, informații înșelătoare sau conținut care încalcă drepturile altora. Imaginile și descrierile rămân responsabilitatea celui care le publică. Poți contacta suportul pentru corectarea unei erori sau raportarea unui anunț.

5. Solicitări, vizionări și plăți
Prețul pe zi, durata, garanția, taxa de serviciu și orice preț de vizionare sunt afișate înainte de confirmarea operațiunii. Unele plăți pot fi autorizate inițial și capturate numai după pașii de verificare și acceptare din aplicație. Plățile și transferurile sunt procesate prin Stripe; PINFERS SRL nu stochează datele complete ale cardului. O solicitare, vizionare sau plată este confirmată numai când statusul din aplicație indică acest lucru. Condițiile concrete ale închirierii și eventualele taxe sunt prezentate în fluxul de comandă și în contractul generat.

6. Identitate, predare și returnare
Pentru anumite operațiuni, ambele părți trebuie să finalizeze verificarea identității prin furnizorul integrat. Predarea și returnarea bunului se confirmă prin funcțiile disponibile în aplicație, inclusiv coduri de confirmare sau scanare, după caz. Păstrează dovezi privind starea bunului și comunică prin mesageria aplicației când apare o problemă.

7. Anulare, dispute și drepturi legale
Anularea și rambursarea depind de stadiul solicitării, de plata efectuată și de condițiile afișate pentru operațiunea respectivă. O autorizație de plată poate fi eliberată dacă solicitarea este refuzată ori expiră, potrivit fluxului de plată. O dispută privind bunul, garanția sau executarea închirierii poate fi raportată la support@pinfers.com. Nimic din acești termeni nu limitează drepturile obligatorii ale consumatorilor; atunci când cealaltă parte este un comerciant, drepturile și informațiile precontractuale aplicabile trebuie respectate de acesta.

8. Disponibilitate și răspundere
Putem suspenda un cont sau un anunț pentru fraudă, utilizare abuzivă, risc de securitate ori încălcarea legii, proporțional cu situația. PINFERS SRL răspunde pentru serviciile digitale furnizate direct, în limitele legii. Persoanele care încheie închirierea răspund pentru obligațiile lor privind bunul și tranzacția; aceste reguli nu înlătură răspunderea pe care legea o atribuie platformei.

9. Date, modificări și contact
Prelucrarea datelor este descrisă în Politica de confidențialitate. Modificările importante ale termenilor vor fi prezentate în aplicație și vor necesita o nouă acceptare înainte de utilizarea funcțiilor care cer cont. Legea aplicabilă este legea română, fără a afecta normele imperative de protecție a consumatorilor. Contact: support@pinfers.com sau adresa societății de mai sus.`,
      en: `Last updated: 4 October 2026

1. Platform operator
PINLEND is operated by PINFERS SRL, Sat Poieni, Str. Mihai Eminescu no. 165, postal code 707441, Iași County, Romania, tax number 54788871, Trade Register no. J2026035406002, EUID ROONRC.J2026035406002. Contact: support@pinfers.com. Website: www.pinfers.ro.

2. The service
PINLEND lets users publish and find listings for renting goods and properties, request and manage rentals, arrange viewings where available, message one another, make payments, verify identity and manage returns. Features may vary by listing category.

3. User roles
The listing owner is responsible for the right to offer the item, its description, condition, price, deposit, availability and handover. The renter must use it under the agreed conditions and return it on time in the agreed condition, allowing for ordinary wear. The rental contract is between these users under the details confirmed in the app. PINFERS SRL supplies the platform and remains responsible for its own digital services under applicable law.

4. Accounts and listings
Provide accurate details, protect your account and publish only lawful, accurate, current listings for items you are entitled to offer. Do not publish prohibited goods, misleading information or content infringing others' rights. The publisher is responsible for listing images and descriptions. Contact support to correct errors or report listings.

5. Requests, viewings and payments
The daily price, duration, deposit, service fee and any viewing fee are shown before confirmation. Some payments may first be authorized and captured only after the verification and acceptance steps in the app. Stripe processes payments and transfers; PINFERS SRL does not store complete card details. A request, viewing or payment is confirmed only when its app status says so. Specific rental terms and fees are displayed in checkout and the generated contract.

6. Identity, handover and return
Some transactions require both parties to complete identity verification through the integrated provider. Handover and return are confirmed using available app functions, including confirmation codes or scanning where applicable. Keep evidence of the item's condition and use app messaging to discuss problems.

7. Cancellation, disputes and legal rights
Cancellation and refunds depend on the request stage, payment and terms shown for that transaction. A payment authorization may be released if a request is declined or expires under the payment flow. Report disputes about the item, deposit or rental performance to support@pinfers.com. These terms do not limit mandatory consumer rights. Where the other party is a trader, that trader must provide applicable precontractual information and respect consumer rights.

8. Availability and liability
We may suspend an account or listing for fraud, abuse, security risks or legal violations in a proportionate way. PINFERS SRL is responsible for its own digital services as required by law. The parties to a rental are responsible for their obligations concerning the item and transaction; this does not remove liability that the law places on the platform.

9. Data, changes and contact
The Privacy Policy explains data processing. Material changes will be shown in the app and require renewed acceptance before using account features. Romanian law applies, without prejudice to mandatory consumer protections. Contact support@pinfers.com or the company address above.`,
    },
  },
  {
    id: "privacy",
    version: "2026-10-04.1",
    title: { ro: "Politica de confidențialitate", en: "Privacy Policy" },
    body: {
      ro: `Data actualizării: 4 octombrie 2026

1. Operator și contact
Această politică descrie prelucrarea datelor în PINLEND. Operatorul datelor este PINFERS SRL, Sat Poieni, Str. Mihai Eminescu nr. 165, cod poștal 707441, județul Iași, România, CUI 54788871, Nr. Reg. Com. J2026035406002. Pentru întrebări și exercitarea drepturilor: support@pinfers.com. Website: www.pinfers.ro.

2. Datele prelucrate
Prelucrăm date de cont și contact (nume, email, telefon, avatar), identificatori de autentificare Apple/Google, anunțuri și media încărcată, locația anunțului și locația dispozitivului când permiți, mesaje, solicitări și contracte de închiriere, vizionări, confirmări de predare/returnare, evaluări, notificări, date despre plăți și transferuri, identificatori Stripe, statusul verificării identității, date tehnice și jurnale de securitate. Documentele de identitate folosite în verificare sunt gestionate prin furnizorul integrat conform fluxului său; pot fi prelucrate datele și statusurile necesare verificării. Nu stocăm numărul complet al cardului.

3. Scopuri și temeiuri
Folosim datele pentru crearea contului, funcționarea anunțurilor și închirierilor, comunicarea între părți, plăți, securitate, prevenirea fraudei și suport. Temeiurile sunt executarea contractului, obligațiile legale și interesele legitime, după caz. Permisiunea pentru locație, cameră, fotografii sau notificări este cerută când folosești funcția relevantă. Marketingul, dacă va fi oferit, cere un temei separat și poate fi retras fără pierderea accesului la serviciul de bază.

4. Destinatari și transferuri
Datele necesare unei tranzacții sunt vizibile celeilalte părți. Putem transmite date către Stripe și Stripe Connect pentru plăți, transferuri și verificarea identității, către Google și Apple pentru autentificare și hărți, Firebase pentru notificări și către furnizori de hosting, stocare, suport și autorități, când este necesar. Unii furnizori pot prelucra date în afara SEE; aplicăm mecanismele de transfer cerute de lege și informațiile furnizorilor.

5. Păstrare și securitate
Păstrăm datele cât este necesar pentru cont, tranzacții, obligații fiscale și legale, soluționarea disputelor și apărarea drepturilor; apoi le ștergem sau anonimizăm potrivit termenelor aplicabile. Folosim măsuri tehnice și organizatorice rezonabile pentru protejarea datelor. Cererea de ștergere a contului poate fi transmisă din aplicație; anumite date pot fi păstrate când legea sau o dispută impune acest lucru.

6. Drepturile tale
Poți solicita acces, rectificare, ștergere, restricționare, portabilitate și opoziție, iar un consimțământ dat poate fi retras. Scrie la support@pinfers.com. Poți depune plângere la autoritatea de supraveghere competentă, inclusiv ANSPDCP în România. Nu folosim decizii exclusiv automatizate care produc efecte juridice sau similare semnificative.

7. Minori și modificări
Serviciul nu este destinat persoanelor care nu pot încheia legal aceste tranzacții. Dacă observăm date ale unui minor fără autorizarea necesară, vom lua măsuri adecvate. Modificările politicii sunt publicate în aplicație cu versiune nouă.`,
      en: `Last updated: 4 October 2026

1. Controller and contact
This policy describes data processing in PINLEND. The data controller is PINFERS SRL, Sat Poieni, Str. Mihai Eminescu no. 165, postal code 707441, Iași County, Romania, tax number 54788871, Trade Register no. J2026035406002. For questions and rights requests: support@pinfers.com. Website: www.pinfers.ro.

2. Data processed
We process account and contact details (name, email, phone, avatar), Apple/Google authentication identifiers, listings and uploaded media, listing locations and device location when permitted, messages, rental requests and contracts, viewings, handover/return confirmations, reviews, notifications, payment and transfer data, Stripe identifiers, identity verification status, technical data and security logs. Identity documents used for verification are handled through the integrated provider under its flow; necessary verification data and statuses may be processed. We do not store complete card numbers.

3. Purposes and legal bases
We use data to create accounts, operate listings and rentals, enable communication, payments, security, fraud prevention and support. Legal bases are contract performance, legal obligations and legitimate interests as applicable. Location, camera, photo and notification permissions are requested when the relevant feature is used. Marketing, if offered, requires a separate legal basis and can be withdrawn without losing the core service.

4. Recipients and transfers
The other party sees data needed for a transaction. We may share data with Stripe and Stripe Connect for payments, transfers and identity verification, Google and Apple for sign-in and maps, Firebase for notifications, hosting, storage and support providers, and authorities when needed. Some providers may process data outside the EEA; legally required transfer mechanisms and provider information apply.

5. Retention and security
We keep data as needed for accounts, transactions, tax and legal duties, disputes and legal claims; then delete or anonymize it under applicable periods. We use reasonable technical and organizational security measures. You can request account deletion in the app; some data may be retained where law or a dispute requires it.

6. Your rights
You may request access, correction, erasure, restriction, portability and object to processing. You may withdraw consent given. Contact support@pinfers.com. You may complain to a competent supervisory authority, including ANSPDCP in Romania. We do not use solely automated decisions with legal or similarly significant effects.

7. Children and changes
The service is not intended for people who cannot lawfully enter these transactions. If we learn of a child's data without required authorization, we will take appropriate steps. Policy updates appear in the app under a new version.`,
    },
  },
  {
    id: "platform-use",
    version: "2026-10-04.1",
    title: {
      ro: "Politica de utilizare a platformei",
      en: "Platform Usage Policy",
    },
    body: {
      ro: `Data actualizării: 4 octombrie 2026

Această politică este emisă de PINFERS SRL pentru aplicația PINLEND. Contact: support@pinfers.com. Website: www.pinfers.ro.

1. Utilizare permisă
Poți căuta și publica anunțuri, comunica, solicita sau administra închirieri și vizionări, efectua plăți și confirma predarea ori returnarea folosind funcțiile aplicației, cu respectarea legii și a drepturilor celorlalți.

2. Utilizare interzisă
Sunt interzise frauda, conturile false, anunțurile înșelătoare sau ilegale, bunurile interzise, hărțuirea, spamul, conținutul care încalcă drepturile altora, manipularea plăților, evitarea neautorizată a comisioanelor, accesul la conturi străine, exploatarea erorilor și atacurile asupra serviciului.

3. Anunțuri și tranzacții
Publică informații și imagini reale, menține disponibilitatea actualizată și respectă prețul și condițiile afișate. Nu folosi mesageria pentru a cere date de card sau documente de identitate în afara fluxurilor securizate. Respectă programările, obligațiile de predare și returnare și comunică prompt orice problemă.

4. Măsuri și raportare
Putem avertiza, limita, suspenda sau închide conturi, elimina anunțuri ori bloca operațiuni când există încălcări sau riscuri, proporțional cu gravitatea. Poți raporta un anunț sau comportament la support@pinfers.com, indicând anunțul și motivul. Poți cere reanalizarea unei măsuri prin același canal.`,
      en: `Last updated: 4 October 2026

This policy is issued by PINFERS SRL for PINLEND. Contact: support@pinfers.com. Website: www.pinfers.ro.

1. Permitted use
You may search and publish listings, communicate, request or manage rentals and viewings, make payments and confirm handover or return through app functions, while respecting the law and others' rights.

2. Prohibited use
Fraud, fake accounts, misleading or unlawful listings, prohibited goods, harassment, spam, infringing content, payment manipulation, unauthorized fee avoidance, access to others' accounts, exploiting bugs and attacking the service are prohibited.

3. Listings and transactions
Publish accurate information and images, keep availability current and honor displayed prices and terms. Do not use messaging to request card details or identity documents outside secure flows. Respect appointments, handover and return duties, and promptly communicate problems.

4. Measures and reporting
We may warn, restrict, suspend or close accounts, remove listings or block operations when there are violations or risks, proportionately. Report listings or conduct to support@pinfers.com with the listing and reason. You may request a review of a measure through the same channel.`,
    },
  },
  {
    id: "owner-terms",
    version: "2026-10-04.1",
    title: {
      ro: "Termeni pentru proprietari și parteneri",
      en: "Owner and Partner Terms",
    },
    body: {
      ro: `Data actualizării: 4 octombrie 2026

Acești termeni se aplică persoanelor și companiilor care publică anunțuri în PINLEND, operată de PINFERS SRL, Sat Poieni, Str. Mihai Eminescu nr. 165, cod poștal 707441, județul Iași, România, CUI 54788871, Nr. Reg. Com. J2026035406002. Website: www.pinfers.ro.

1. Dreptul de a publica
Confirmi că ai dreptul de a oferi bunul sau proprietatea spre închiriere și că deții autorizațiile necesare. Dacă acționezi pentru o companie, confirmi dreptul de reprezentare. Furnizezi informații corecte privind identitatea, prețul, disponibilitatea, starea bunului, garanția, predarea, anularea și orice restricții.

2. Contractul și executarea
Ești partea care oferă bunul și răspunzi pentru descriere, siguranță, conformitate și executarea obligațiilor față de chiriaș. Confirmi sau respingi solicitările în aplicație, participi la verificările de identitate cerute, predai bunul în condițiile convenite și gestionezi reclamațiile și returnarea conform contractului și legii. Dacă ești comerciant, furnizezi informațiile și respecți drepturile consumatorului aplicabile tranzacției.

3. Prețuri și transferuri
Prețul, garanția, taxele de serviciu și, dacă există, prețul vizionării se afișează înainte de plată. Transferurile către tine pot necesita configurarea și verificarea contului Stripe Connect. Plățile, reținerile, anulările, rambursările și transferurile urmează statusurile și regulile afișate pentru tranzacție; nu se garantează un anumit număr de solicitări sau venituri.

4. Conținut, date și măsuri
Declari că ai dreptul să folosești textele și imaginile încărcate și permiți afișarea lor în PINLEND pentru furnizarea serviciului. Folosești datele chiriașilor doar pentru executarea tranzacției și obligațiile legale, respectând protecția datelor. PINFERS SRL poate suspenda anunțuri sau conturi pentru fraudă, date false, încălcări ale legii ori riscuri pentru utilizatori, proporțional cu situația. Poți cere reanalizare la support@pinfers.com.

5. Modificări și contact
Modificările importante vor fi prezentate în aplicație și necesită acceptare nouă. Se aplică legea română, cu respectarea normelor imperative. Contact: support@pinfers.com.`,
      en: `Last updated: 4 October 2026

These terms apply to people and companies publishing listings in PINLEND, operated by PINFERS SRL, Sat Poieni, Str. Mihai Eminescu no. 165, postal code 707441, Iași County, Romania, tax number 54788871, Trade Register no. J2026035406002. Website: www.pinfers.ro.

1. Right to list
You confirm your right to rent out the item or property and that you hold required authorizations. If acting for a company, you confirm authority to represent it. Provide accurate information about identity, price, availability, condition, deposit, handover, cancellation and restrictions.

2. Contract and performance
You offer the item and are responsible for its description, safety, conformity and performance of obligations to the renter. Accept or decline requests in the app, complete required identity checks, hand over the item as agreed and handle complaints and returns under the contract and law. If you are a trader, provide information and honor consumer rights applicable to the transaction.

3. Prices and transfers
The price, deposit, service fees and any viewing price are shown before payment. Transfers to you may require Stripe Connect setup and verification. Payments, holds, cancellations, refunds and transfers follow transaction statuses and displayed rules; no number of requests or earnings is guaranteed.

4. Content, data and measures
You confirm your right to use uploaded text and images and allow their display in PINLEND to provide the service. Use renter data only to perform the transaction and meet legal obligations, respecting data protection law. PINFERS SRL may suspend listings or accounts for fraud, false data, legal violations or user risks proportionately. Request a review at support@pinfers.com.

5. Changes and contact
Material changes appear in the app and require renewed acceptance. Romanian law applies subject to mandatory rules. Contact: support@pinfers.com.`,
    },
  },
];

export const legalDocuments = sources.map((source) => ({
  ...source,
  hash: createHash("sha256")
    .update(
      `${source.id}\n${source.version}\n${source.body.ro}\n${source.body.en}`,
    )
    .digest("hex"),
}));
