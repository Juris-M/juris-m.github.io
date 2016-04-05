======================
Juris-M: United States
======================

This guide applies to Juris-M items set to the ``US`` jurisdiction. It covers
federal resources; cite forms for state and federal subjurisdictions
may be impose their own variants.

In production with Juris-M, use the ``Abbreviation Filter`` to
transform or suppress jurisdiction names as appropriate.

--------------
Citation Forms
--------------

In the input guidance below, required fields are set in **boldface**;
entries set in *italics* are optional.

^^^^
Case
^^^^
    
[Reported cases]
    Required fields: **Case Name**, **Reporter Volume**, **Reporter**,
    **First Page**, **Court**, **Date Decided**, and **Jurisdiction**.

    Notes:

    **Case Name:** The full name of the case to be shown in citations.
    Enter both parties, connected by ``v.`` as appropriate (with a period).

    **Reporter:** The reporter. Reporters entered in full form (recommended)
    can be shortened in citations using the ``Abbreviation Filter``.

    **First Page:** A range of pages may be entered here: only the first
    page will be used in citations.

    **Court:** The name of the court. This is set to appear in all
    citations, because some courts (such as ``Bankr.``) should be
    shown. To suppress unwanted court names, use the abbreviation hack
    noted above. In Juris-M, court names are entered from a controlled
    list to assure consistency. Contact the project to request that
    courts be added to the listings.

    **Jurisdiction:** The name of the jurisdiction. In Juris-M this is
    set from a controlled list, and transformed or suppressed using
    the ``Abbreviation Filter``.

[Unreported cases]
    Required fields: **Case Name**, **Court**, and
    **Jurisdiction**.

    Notes:

    Juris-M generates an unreported-case citation when the ``Reporter``
    field is omitted.

    **Docket Number:** The docket number of the dispute, as written
    in the judgment, without any generic prefix such as ``No.``
    
    **Date Decided:** The specific date is important for unreported
    judgments. Enter this in ``YYYY-MM-DD`` format.

    *First Page:* If a value is provided in this field, the pinpoint
    format will adjust to conform to Bluebook rule 10.8.1(b) (at p. 105).

[Court documents]
    Required fields: Same as for the judgment (see **[Reported
    cases]** and **[Unreported cases]** above), plus **Document
    Name**.

    Notes:

    When present, the **Document Name** field changes the citation logic
    in two respects:

    * The citation pinpoint will apply to the document, rather
      than to the cited judgment.

    * The **Short Title** field will be used as the short title of
      the cited document, rather than the case.

^^^^^^^
Statute
^^^^^^^

[Statutes at Large]
    Required fields: **Name of Act**, **Gazette Ref**, **Public Law Number**, **Code
    Number**, **Code**, **Pages**, **Date Enacted**, **Jurisdiction**.

    One or both of **Section** and **Locator** are also required.

    A cite to Statutes at Large requires two pinpoints. To enter the second
    pinpoint (the page number) when citing a statute, append it to the
    pinpoint section in the ``Locator`` field with a **|** character, thus:
    ``sec. 123|456``.

    Notes:

    **Public Law Number:** By default, the module applies the label ``Pub. L. No.``
    to a simple field value. Where the label should be changed to ``ch.``, enter
    the prefix in the field directly, thus: ``ch. 50``.

    **Gazette Ref:** This is a toggle in the Juris-M user interface. It must be set
    to render citations to Statutes at Large.

    **Code Number:** For cites to Statutes at Large, this will be the volume
    containing the cited statute.

    **Code:** For cites to Statutes at Large, this will be ``Stat.`` (you may
    enter the full name, and use the ``Abbreviation Filter`` to shorten the
    name in citations).

    *Section:* To create an entry for an individual provision of the
    cited statute (useful for note-taking), enter the section number
    in the ``Section`` field. This will be merged in citations with
    the value set (in the word-processor plugin) in the ``Locator``
    field.

    *Locator:* To set a locator as a section number, add a prefix,
    thus: ``sec. 123``. To add a section to an existing ``Section``
    value set in the item data, you can use a form like this: ``& sec. 456``.

[U.S. Code]
    Required fields: **Name of Act**, **Code Number**, **Code**, **Date Enacted**,
    **Jurisdiction**.

    The ``Gazette Ref`` toggle must *not* be set on ``Code`` items.

    One or both of **Section** or **Locator** are also required.

    Notes:

    **Code Number:** For U.S. Code cites, this field holds the title where
    the cited provision is located.

    **Code:** This will be ``U.S.C.`` (or ``United States Code``, transformed
    to the short form by the ``Abbreviation Filter``).

    *Locator:* To set a section number in the ``Locator`` field, prefix
    it with ``sec.`` (see above under **[Statutes at Large]** for details).

^^^^
Bill
^^^^

[Bills in Congress]
    Required fields: **Legislative Body**, **Bill Number**, **Assy. No.**, **Date**, **Jurisdiction**.

    One or both of **Section** or **Locator** are also required.

    Notes:

    *Title:* Bills will ordinarily have a title, but Juris-M will
    generate a useful citation without one.

    **Legislative Body:** This field should provide both the name of
    the body (Congress) and the name of the chamber, separated by a
    **|** character, thus: ``Cong.|H.R.`` or
    ``Cong.|S.``. Alternatively, you may wish to enter the full names,
    and use the ``Abbreviation Filter`` to shorten them in
    citations. In full form, entries would like like this:
    ``Congress|House of Representatives`` or ``Congress|Senate``.

    **Bill Number:** Enter the number of the bill within the session
    here.

    **Assy. No.:** This is the number of the sitting Congress. For
    example, the 105th Congress sat from 3 January 1997 to 3 January 1999.

    *Session:* A sitting Congress is divided into two (and possibly
    three) sessions. The Bluebook states an odd rule (rule 13) for
    when this information should be included or omitted from
    citations. Juris-M will include the session number if the data is
    recorded in the item; it can be removed manually at the final
    stage of production if desired.

[Resolutions]
    Required fields: **Resol. Label**, **Bill Number**, **Assy. No.**, 
    **Date**, **Jurisdiction**.

    One or both of **Session** or **Locator** are also required.

    Notes:

    **Resol. Label:** Enter the label of the resolution here, such as:
    ``H.R.J. Res.`` (you may also use the full form, and shorten the
    label with the ``Abbreviation Filter``. When a value is present
    in this field, Juris-M will render resolution-form citation.

    See above under **[Bills in Congress]** for details on the other fields.

^^^^^^^^^^
Regulation
^^^^^^^^^^

[Federal Register]
    Required fields: **Name of Act**, **Gazette Ref**, **Volume**,
    **Reporter**, **Pages**, **Date Enacted**, **Jurisdiction**.

    With the **Gazette Ref**, Juris-M will generate a reference
    in the form appropriate to the Federal Register.

    Do *not* enter a value in the ``Section`` field for references
    of this type: use ``Pages`` instead.

    Notes:

    **Name of Act:** The name of this field is not a perfect fit
    for the content, but the name of the regulation goes here.

    **Date Enacted:** Give the full date for gazetted regulations,
    in the form ``YYYY-MM-DD``.

    **Jurisdiction:** To suppress the ``Jurisdiction`` field in
    output, use the hack syntax described at the top of this Cheat
    Sheet. (It is included in references by default because it may be
    needed in comparative law discourse.)

[Code of Federal Regulations]
    Required fields: **Name of Act**, **Volume**, **Reporter**, **Date
    Enacted**, **Jurisdiction**.

    One or both of **Section** or **Locator** are also required.

    The ``Gazette Ref`` field must *not* be included in items
    referring to the C.F.R.

    Notes:

    See above under **[U.S. Code]** for guidance notes on individual fields
    for this type.

^^^^^^^
Hearing
^^^^^^^

[Committee Hearings]
     Required fields: **Title**, **Committee**, **Assy. No.**,
     **Legislative Body**, **Date**, **Jurisdiction**.

     When a value is present in the **Committee** field, Juris-M will
     generate a citation to a committee hearing.

     Notes:

     See above under **[Bills in Congress]** for details on the
     individual fields.

[Congressional Debates]
    Required fields: **Volume**, **Reporter**, **Pages**, **Date**, **Jurisdiction**.

    The ``Committee`` field must be *empty* for an item referring
    to congressional debates.

    Notes:

    **Date:** The full date should be entered, in the form ``YYYY-MM-DD``.

    *Title:* If a value is present in the ``Title`` field, it will
    be included in citations; however, a congressional debate normally
    has no title.

^^^^^^
Report
^^^^^^

Report come in many flavours, and the metadata describing them must
generally be entered manually. After entering the required fields an
item, stir in additional information to produce the desired citation
form.

[Committee Reports]
    Required fields: **Committee**, **Title**, **Assy No.**, **Institution**,
    **Date**, **Jurisdiction**.

    With a value in the **Committee** field, Juris-M will generate
    a citation appropriate to a committee report.

    Notes:

    *Author:* When a value is present in the ``Author`` field, it will
    be used instead of the committee name. This accomodates the weird
    example given Bluebook rule 13.1, where the author of a committee
    print is given as "Staff of H. Comm. on the Judiciary."

    **Assy. No.:** If the number of the sitting Congress is provided,
    and no value is given for ``Report Number``, this information will
    be included in citations. This conforms to the "Committee print" example
    given in Bluebook rule 13.1.

    **Institution:** Both the name of the legislative body (Congress) and
    the chamber should be entered here, separated with a **|** character, thus:
    ``Cong.|H.R.``. If the names are spelled out in full, they can be shortened
    in citations with the ``Abbreviation Filter``.

    *Report Number:* While Bluebook examples do not show document numbers
    on committee prints, other citations guides do so. If the information is
    entered in this field, Juris-M will include it in citations, in preference
    to the ``Assy. No.``

    *Report Type:* By default, Juris-M composes a label for  the ``Report Number``
    from the name of the legislative chamber (in short form) and the suffix ``Rep.``
    (for "Report"). To change the suffix to another value (such as ``Doc.``, or ``Prt.``),
    enter the alternative suffix in this field.

[Congressional Reports and Documents]
    Required fields: **Institution**, **Report Number**, **Date**,
    **Jurisdiction**.
    
    If the ``Committee`` and ``Title`` fields are *both* empty, Juris-M
    will generate citations in the form shown in Bluebook rule 13.1 for
    federal reports and documents.

    Notes:

    *Report Type:* See above under **[Committee Reports]** for details on the use
    of this field.
