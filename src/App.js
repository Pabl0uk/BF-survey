// src/App.js
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Image,
  Accordion,
  Table,
} from "react-bootstrap";
import SORSection from "./components/SORSection";
import "./index.css";

// 1) Fixed list of desired sections; “contractor work” stays last
const desiredOrder = [
  "general",
  "asbestos",
  "decoration",
  "lorry clearance",
  "external works",
  "sheds",
  "loft",
  "hall/stair/landing",
  "w/c (closet)",
  "living room",
  "dining room",
  "kitchen",
  "bathroom/wetroom",
  "bedroom 1",
  "bedroom 2",
  "bedroom 3",
  "bedroom 4",
  "contractor work",
];

// 2) Title‐case helper for section headers
const titleCase = (str) => {
  if (!str) return "";
  const s = str.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// 3) Safe float parse (default 0)
const parseNum = (val) => {
  const x = parseFloat(val);
  return isNaN(x) ? 0 : x;
};

function App() {
  // ──────────────────────────────────────────────────────────
  // State: All sections (arrays of SOR rows or free‐form rows)
  // ──────────────────────────────────────────────────────────
  const [sors, setSors] = useState({});

  // ──────────────────────────────────────────────────────────
  // State: Did the user click “Start Survey”?
  // ──────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);

  // ──────────────────────────────────────────────────────────
  // State: Surveyor info
  // ──────────────────────────────────────────────────────────
  const [surveyorName, setSurveyorName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");

  // ──────────────────────────────────────────────────────────
  // State: Summary‐row fields
  // ──────────────────────────────────────────────────────────
  const [voidRating, setVoidRating] = useState("Green");
  const [voidType, setVoidType] = useState("Minor");
  const [overallComments, setOverallComments] = useState("");
  const [mwrRequired, setMWRRequired] = useState(false);

  // ──────────────────────────────────────────────────────────
  // On mount: fetch SOR definitions and initialize each section with an empty array if not present
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/sors.json")
      .then((res) => res.json())
      .then((data) => {
        const merged = {};
        desiredOrder.forEach((key) => {
          merged[key] = Array.isArray(data[key]) ? data[key] : [];
        });
        merged.searchable = Array.isArray(data.searchable)
          ? data.searchable
          : [];
        setSors(merged);
      })
      .catch((err) => console.error("Failed to load sors.json", err));
  }, []);

  // ──────────────────────────────────────────────────────────
  // Compute Totals
  //
  // We want:
  //   • totalVoidSMV, totalVoidCost
  //   • totalRechargeSMV, totalRechargeCost
  //
  // Rules:
  //   - For “lorry clearance” & “contractor work” (free‐form lines):
  //       • cost ALWAYS adds to voidCost.
  //       • if item.recharge === true:
  //           • cost also adds to rechargeCost,
  //           • timeEstimate (in hours) → convert to minutes → add to rechargeSMV ONLY.
  //         else:
  //           • timeEstimate (hours→minutes) adds to voidSMV ONLY.
  //
  //   - For all OTHER sections (SOR‐based):
  //       • cost ALWAYS adds to voidCost.
  //       • if sor.recharge === true:
  //           • cost also adds to rechargeCost,
  //           • smv (already in minutes) adds to both voidSMV and rechargeSMV.
  //         else:
  //           • smv adds to voidSMV ONLY.
  //
  // Void Days = voidSMV ÷ 450
  // Recharge Days = rechargeSMV ÷ 400
  // ──────────────────────────────────────────────────────────
  const computeTotals = () => {
    let totalVoidSMV = 0;
    let totalVoidCost = 0;
    let totalRechargeSMV = 0;
    let totalRechargeCost = 0;

    Object.keys(sors).forEach((sectionKey) => {
      if (sectionKey === "searchable") return;
      const arr = Array.isArray(sors[sectionKey]) ? sors[sectionKey] : [];

      arr.forEach((item) => {
        // Determine if this is a free‐form “lorry clearance” or “contractor work” row
        const isFreeForm =
          sectionKey === "lorry clearance" || sectionKey === "contractor work";

        if (isFreeForm) {
          // item must have: description, cost, timeEstimate (in hours), recharge (boolean)
          const cost = parseNum(item.cost);
          const timeHours = parseNum(item.timeEstimate);
          const timeMinutes = timeHours * 60;

          // 1) Cost always goes into voidCost
          totalVoidCost += cost;

          if (item.recharge) {
            // If flagged recharge: cost also into rechargeCost, timeMinutes → rechargeSMV
            totalRechargeCost += cost;
            totalRechargeSMV += timeMinutes;
          }
          // If not flagged recharge: do NOT add time to voidSMV
        } else {
          // Regular SOR row: has smv (minutes), cost (per‐unit), quantity, recharge flag
          const quantity = parseNum(item.quantity || 0);
          const smv = parseNum(item.smv) * quantity;
          const cost = parseNum(item.cost) * quantity;

          // 1) Cost always goes into voidCost
          totalVoidCost += cost;

          if (item.recharge) {
            // 2a) Flagged recharge → add to both void & recharge
            totalRechargeCost += cost;
            totalRechargeSMV += smv;
            totalVoidSMV += smv;
          } else {
            // 2b) Not flagged → only to void
            totalVoidSMV += smv;
          }
        }
      });
    });

    const voidDaysDecimal = totalVoidSMV / 450;
    const rechargeDaysDecimal = totalRechargeSMV / 400;

    return {
      smv: Math.round(totalVoidSMV), // total minutes for void
      cost: totalVoidCost.toFixed(2),
      daysDecimal: voidDaysDecimal,
      rechargeDaysDecimal,
      rechargeCost: totalRechargeCost.toFixed(2),
    };
  };

  const totals = computeTotals();
  const sectionKeys = desiredOrder.filter((key) => key in sors);

  // ──────────────────────────────────────────────────────────
  // Collect all “recharged” items into a single array for the Recharges table
  // ──────────────────────────────────────────────────────────
  const getAllRechargeItems = () => {
    const result = [];
    Object.keys(sors).forEach((sectionKey) => {
      if (sectionKey === "searchable") return;
      const arr = Array.isArray(sors[sectionKey]) ? sors[sectionKey] : [];

      arr.forEach((item) => {
        const isFreeForm =
          sectionKey === "lorry clearance" || sectionKey === "contractor work";

        if (isFreeForm) {
          const cost = parseNum(item.cost);
          const timeHours = parseNum(item.timeEstimate);
          if (item.recharge) {
            result.push({
              section: sectionKey,
              code: "", // no code for free‐form
              description: item.description || "",
              cost: cost.toFixed(2),
              comment: item.comment || "",
            });
          }
        } else {
          const qty = parseNum(item.quantity || 0);
          const cost = parseNum(item.cost) * qty;
          if (item.recharge) {
            result.push({
              section: sectionKey,
              code: item.code || "",
              description: item.description || "",
              cost: cost.toFixed(2),
              comment: item.comment || "",
            });
          }
        }
      });
    });
    return result;
  };

  // ──────────────────────────────────────────────────────────
  // Handlers to add / update / remove items
  // ──────────────────────────────────────────────────────────

  // When adding a new SOR or free‐form row: initialize necessary fields
  const handleAddSOR = (section, newSOR) => {
    setSors((prev) => {
      const arr = Array.isArray(prev[section]) ? prev[section] : [];
      // If this is “lorry clearance” or “contractor work”, newSOR is free‐form:
      if (section === "lorry clearance" || section === "contractor work") {
        // Expect newSOR = { description: "", cost: "", timeEstimate: "", recharge: false, comment: "" }
        return {
          ...prev,
          [section]: [...arr, newSOR],
        };
      } else {
        // Regular SOR row from JSON: initialize quantity, comment, recharge=false
        const row = {
          ...newSOR,
          quantity: "",
          comment: "",
          recharge: false,
        };
        return {
          ...prev,
          [section]: [...arr, row],
        };
      }
    });
  };

  const handleUpdateSOR = (section, idx, updatedSOR) => {
    setSors((prev) => {
      const arr = Array.isArray(prev[section]) ? [...prev[section]] : [];
      arr[idx] = updatedSOR;
      return { ...prev, [section]: arr };
    });
  };

  const handleRemoveSOR = (section, idx) => {
    setSors((prev) => {
      const arr = Array.isArray(prev[section]) ? [...prev[section]] : [];
      arr.splice(idx, 1);
      return { ...prev, [section]: arr };
    });
  };

  // ──────────────────────────────────────────────────────────
  // Export to Excel
  // ──────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const XLSX = require("xlsx");

    // Build Summary AoA
    const aoa = [
      ["Surveyor Name", surveyorName],
      ["Property Address", propertyAddress],
      ["Void Rating", voidRating],
      ["Void Type", voidType],
      ["MWR Required", mwrRequired ? "Yes" : "No"],
      ["Total SMV (min)", totals.smv],
      ["Total Void Days", totals.daysDecimal.toFixed(1)],
      ["Total Cost (£)", totals.cost],
      ["Recharge Days", totals.rechargeDaysDecimal.toFixed(1)],
      ["Recharge Cost (£)", totals.rechargeCost],
      ["Comments", overallComments],
    ];

    // Append Contractor Work & Lorry Clearance free‐form lines if any
    const freeForms = (sectionKey) =>
      (sors[sectionKey] || []).map((row) => [
        row.description || "",
        row.cost || "",
        row.timeEstimate || "",
        row.recharge ? "Yes" : "No",
        row.comment || "",
      ]);

    // If there are any “contractor work” lines, add a section
    const contractorRows = freeForms("contractor work");
    if (contractorRows.length > 0) {
      aoa.push([]);
      aoa.push([
        "Contractor Description",
        "Cost (£)",
        "Time (hrs)",
        "Recharge?",
        "Comment",
      ]);
      contractorRows.forEach((r) => aoa.push(r));
    }

    // If there are any “lorry clearance” lines, add a section
    const lorryRows = freeForms("lorry clearance");
    if (lorryRows.length > 0) {
      aoa.push([]);
      aoa.push([
        "Lorry Clearance Description",
        "Cost (£)",
        "Time (hrs)",
        "Recharge?",
        "Comment",
      ]);
      lorryRows.forEach((r) => aoa.push(r));
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(aoa);

    // Build SOR Details AoA
    const detailsAoA = [
      [
        "Section",
        "Code",
        "Description",
        "UOM",
        "Quantity",
        "SMV",
        "Cost (£)",
        "Comment",
        "Recharge?",
      ],
    ];
    sectionKeys.forEach((section) => {
      if (
        section === "searchable" ||
        section === "contractor work" ||
        section === "lorry clearance"
      )
        return;
      (sors[section] || []).forEach((sor) => {
        detailsAoA.push([
          titleCase(section),
          sor.code || "",
          sor.description || "",
          sor.uom || "",
          sor.quantity || "",
          sor.smv || "",
          sor.cost || "",
          sor.comment || "",
          sor.recharge ? "Yes" : "No",
        ]);
      });
    });
    const wsDetails = XLSX.utils.aoa_to_sheet(detailsAoA);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    XLSX.utils.book_append_sheet(wb, wsDetails, "SOR Details");

    const safeAddr = propertyAddress.replace(/\s+/g, "_");
    XLSX.writeFile(wb, `Empty_Homes_Survey_${safeAddr}.xlsx`);
  };

  // ──────────────────────────────────────────────────────────
  // Export to PDF
  // ──────────────────────────────────────────────────────────
  const exportToPDF = () => {
    const jsPDF = require("jspdf").default;
    require("jspdf-autotable");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    let y = 40;

    // Title
    doc.setFontSize(18);
    doc.text("Empty Homes Survey", 40, y);
    y += 30;

    // Summary fields
    doc.setFontSize(11);
    const summaryLines = [
      ["Surveyor Name:", surveyorName],
      ["Property Address:", propertyAddress],
      ["Void Rating:", voidRating],
      ["Void Type:", voidType],
      ["MWR Required:", mwrRequired ? "Yes" : "No"],
      ["Total SMV (min):", totals.smv.toString()],
      ["Total Void Days:", totals.daysDecimal.toFixed(1)],
      ["Total Cost (£):", totals.cost.toString()],
      ["Recharge Days:", totals.rechargeDaysDecimal.toFixed(1)],
      ["Recharge Cost (£):", totals.rechargeCost.toString()],
      ["Comments:", overallComments],
    ];
    summaryLines.forEach((pair) => {
      doc.text(`${pair[0]} ${pair[1]}`, 40, y);
      y += 16;
    });
    y += 10;

    // If free‐form “contractor work” rows exist
    const contractors = sors["contractor work"] || [];
    if (contractors.length > 0) {
      doc.autoTable({
        startY: y,
        head: [
          [
            "Contractor Description",
            "Cost (£)",
            "Time (hrs)",
            "Recharge?",
            "Comment",
          ],
        ],
        body: contractors.map((cw) => [
          cw.description || "",
          cw.cost || "",
          cw.timeEstimate || "",
          cw.recharge ? "Yes" : "No",
          cw.comment || "",
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [240, 240, 240] },
      });
      y = doc.lastAutoTable.finalY + 20;
    }

    // If free‐form “lorry clearance” rows exist
    const lorries = sors["lorry clearance"] || [];
    if (lorries.length > 0) {
      doc.autoTable({
        startY: y,
        head: [
          [
            "Lorry Clearance Description",
            "Cost (£)",
            "Time (hrs)",
            "Recharge?",
            "Comment",
          ],
        ],
        body: lorries.map((cw) => [
          cw.description || "",
          cw.cost || "",
          cw.timeEstimate || "",
          cw.recharge ? "Yes" : "No",
          cw.comment || "",
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [240, 240, 240] },
      });
      y = doc.lastAutoTable.finalY + 20;
    }

    // SOR Details table (excluding free‐form sections)
    const detailRows = [];
    sectionKeys.forEach((section) => {
      if (
        section === "searchable" ||
        section === "contractor work" ||
        section === "lorry clearance"
      )
        return;
      (sors[section] || []).forEach((sor) => {
        detailRows.push([
          titleCase(section),
          sor.code || "",
          sor.description || "",
          sor.uom || "",
          sor.quantity || "",
          sor.smv || "",
          sor.cost || "",
          sor.comment || "",
          sor.recharge ? "Yes" : "No",
        ]);
      });
    });

    doc.autoTable({
      startY: y,
      head: [
        [
          "Section",
          "Code",
          "Description",
          "UOM",
          "Quantity",
          "SMV",
          "Cost (£)",
          "Comment",
          "Recharge?",
        ],
      ],
      body: detailRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [240, 240, 240] },
      margin: { left: 40, right: 20 },
    });

    const safeAddr = propertyAddress.replace(/\s+/g, "_");
    doc.save(`Empty_Homes_Survey_${safeAddr}.pdf`);
  };

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────
  return (
    <Container fluid className="p-0">
      {!showForm ? (
        <>
          {/* ——— Start Screen ——— */}
          <div className="text-center mb-5">
            <Image
              src="/bromford-logo.png"
              alt="Bromford logo"
              height={80}
              className="mb-4"
            />
            <h1 className="mb-4">Empty Homes Survey</h1>
          </div>
          <Row className="justify-content-center">
            <Col xs={10} md={6} lg={4}>
              <Card>
                <Card.Body>
                  <Form>
                    <Form.Group controlId="surveyorName" className="mb-3">
                      <Form.Label>Surveyor Name</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter name"
                        value={surveyorName}
                        onChange={(e) => setSurveyorName(e.target.value)}
                      />
                    </Form.Group>
                    <Form.Group controlId="propertyAddress" className="mb-3">
                      <Form.Label>Property Address</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter address"
                        value={propertyAddress}
                        onChange={(e) => setPropertyAddress(e.target.value)}
                      />
                    </Form.Group>
                    <Button
                      variant="primary"
                      className="w-100"
                      onClick={() => setShowForm(true)}
                      disabled={!surveyorName || !propertyAddress}
                    >
                      Start Survey
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <>
          {/* ─── Sticky Header for ≥ md screens ─── */}
          <div
            className="d-none d-md-block sticky-top bg-white shadow-sm"
            style={{ zIndex: 1020 }}
          >
            <Container fluid className="py-2">
              <Row className="align-items-center">
                <Col xs="auto">
                  <Image
                    src="/bromford-logo.png"
                    alt="Bromford logo"
                    height={48}
                    className="me-3"
                  />
                </Col>
                <Col>
                  <h5 className="mb-0">
                    {surveyorName} — {propertyAddress}
                  </h5>
                </Col>
              </Row>
              <Row className="g-3 mt-2">
                <Col xs={6} md={2}>
                  <Card className="h-100 text-center">
                    <Card.Body>
                      <Card.Title as="h6" className="text-muted">
                        SMV
                      </Card.Title>
                      <Card.Text className="fs-4 fw-bold">
                        {totals.smv} min
                      </Card.Text>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={6} md={2}>
                  <Card className="h-100 text-center">
                    <Card.Body>
                      <Card.Title as="h6" className="text-muted">
                        Void Days
                      </Card.Title>
                      <Card.Text className="fs-4 fw-bold">
                        {totals.daysDecimal.toFixed(1)}
                      </Card.Text>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={6} md={2}>
                  <Card className="h-100 text-center">
                    <Card.Body>
                      <Card.Title as="h6" className="text-muted">
                        Cost
                      </Card.Title>
                      <Card.Text className="fs-4 fw-bold">
                        £{totals.cost}
                      </Card.Text>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={6} md={2}>
                  <Card className="h-100">
                    <Card.Body className="text-center">
                      <Card.Title as="h6" className="text-muted">
                        Void Rating
                      </Card.Title>
                      <Form.Select
                        value={voidRating}
                        onChange={(e) => setVoidRating(e.target.value)}
                      >
                        <option>Green</option>
                        <option>Amber</option>
                        <option>Red</option>
                      </Form.Select>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={6} md={2}>
                  <Card className="h-100">
                    <Card.Body className="text-center">
                      <Card.Title as="h6" className="text-muted">
                        Void Type
                      </Card.Title>
                      <Form.Select
                        value={voidType}
                        onChange={(e) => setVoidType(e.target.value)}
                      >
                        <option>Minor</option>
                        <option>Major</option>
                      </Form.Select>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Container>
          </div>

          {/* ─── Static Header for < md screens ─── */}
          <div className="d-block d-md-none bg-white border-bottom py-2">
            <Container fluid>
              <Row className="align-items-center">
                <Col xs="auto">
                  <Image src="/bromford-logo.png" height={32} alt="logo" />
                </Col>
                <Col>
                  <small className="fw-bold">
                    {surveyorName} — {propertyAddress}
                  </small>
                </Col>
              </Row>
              <Row className="g-2 mt-1">
                <Col xs={4}>
                  <Card className="text-center">
                    <Card.Body className="p-1">
                      <Card.Title as="div" className="text-muted small mb-1">
                        SMV
                      </Card.Title>
                      <Card.Text className="fw-bold">{totals.smv}m</Card.Text>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={4}>
                  <Card className="text-center">
                    <Card.Body className="p-1">
                      <Card.Title as="div" className="text-muted small mb-1">
                        Void Days
                      </Card.Title>
                      <Card.Text className="fw-bold">
                        {totals.daysDecimal.toFixed(1)}
                      </Card.Text>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={4}>
                  <Card className="text-center">
                    <Card.Body className="p-1">
                      <Card.Title as="div" className="text-muted small mb-1">
                        Cost
                      </Card.Title>
                      <Card.Text className="fw-bold">£{totals.cost}</Card.Text>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              <Row className="g-2 mt-1">
                <Col xs={6}>
                  <Form.Group>
                    <Form.Label className="text-muted small mb-1">
                      Void Rating
                    </Form.Label>
                    <Form.Select
                      size="sm"
                      value={voidRating}
                      onChange={(e) => setVoidRating(e.target.value)}
                    >
                      <option>Green</option>
                      <option>Amber</option>
                      <option>Red</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={6}>
                  <Form.Group>
                    <Form.Label className="text-muted small mb-1">
                      Void Type
                    </Form.Label>
                    <Form.Select
                      size="sm"
                      value={voidType}
                      onChange={(e) => setVoidType(e.target.value)}
                    >
                      <option>Minor</option>
                      <option>Major</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
            </Container>
          </div>

          {/* ─── Spacer for md+ sticky header ─── */}
          <div style={{ height: "30px" }}></div>

          {/* ─── Main Form Sections ─── */}
          <Container fluid className="px-4">
            <Accordion defaultActiveKey="none" flush>
              {sectionKeys.map((section) => (
                <Accordion.Item eventKey={section} key={section} className="mb-3">
                  <Accordion.Header>{titleCase(section)}</Accordion.Header>
                  <Accordion.Body>
                    <SORSection
                      section={section}
                      sors={sors}
                      onAddSOR={handleAddSOR}
                      onUpdateSOR={handleUpdateSOR}
                      onRemoveSOR={handleRemoveSOR}
                    />
                  </Accordion.Body>
                </Accordion.Item>
              ))}

              {/* ─── Recharges Accordion ─── */}
              <Accordion.Item eventKey="recharges" className="mb-3">
                <Accordion.Header>Recharges</Accordion.Header>
                <Accordion.Body>
                  {/* Two cards side by side: Recharge Days & Recharge Cost */}
                  <Row className="g-3 mb-3">
                    <Col xs={6}>
                      <Card className="h-100 text-center">
                        <Card.Body>
                          <Card.Title as="h6" className="text-muted">
                            Recharge Days
                          </Card.Title>
                          <Card.Text className="fs-4 fw-bold">
                            {totals.rechargeDaysDecimal.toFixed(1)}
                          </Card.Text>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col xs={6}>
                      <Card className="h-100 text-center">
                        <Card.Body>
                          <Card.Title as="h6" className="text-muted">
                            Recharge Cost
                          </Card.Title>
                          <Card.Text className="fs-4 fw-bold">
                            £{totals.rechargeCost}
                          </Card.Text>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Warning if > 5 days of recharge work */}
                  {totals.rechargeDaysDecimal > 5 && (
                    <div className="alert alert-warning">
                      This is over 5 days of recharge work – if this is a transfer,
                      decline this.
                    </div>
                  )}

                  {/* Recharge Details Table */}
                  <Table bordered hover size="sm">
                    <thead className="table-light">
                      <tr>
                        <th>Section</th>
                        <th>Code</th>
                        <th>Description</th>
                        <th>Cost (£)</th>
                        <th>Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getAllRechargeItems().length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted">
                            No recharge items added yet.
                          </td>
                        </tr>
                      ) : (
                        getAllRechargeItems().map((i, idx) => (
                          <tr key={"rch-" + idx}>
                            <td>{titleCase(i.section)}</td>
                            <td>{i.code}</td>
                            <td>{i.description}</td>
                            <td>£{i.cost}</td>
                            <td>{i.comment}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </Accordion.Body>
              </Accordion.Item>

              {/* ─── Final “Comments” Accordion ─── */}
              <Accordion.Item eventKey="survey-comments" className="mb-3">
                <Accordion.Header>Comments</Accordion.Header>
                <Accordion.Body>
                  <Form.Group controlId="surveyComments">
                    <Form.Label className="fw-medium">
                      Overall Survey Comments
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      placeholder="Enter any general notes…"
                      value={overallComments}
                      onChange={(e) => setOverallComments(e.target.value)}
                    />
                  </Form.Group>
                  <div className="mt-3">
                    <Form.Check
                      type="checkbox"
                      label="Does this require a MWR?"
                      checked={mwrRequired}
                      onChange={(e) => setMWRRequired(e.target.checked)}
                    />
                  </div>
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>
          </Container>

          {/* ─── Export Buttons (bottom) ─── */}
          <Container fluid className="px-4 mt-4 mb-5 text-center">
            <Button
              variant="success"
              className="me-3"
              onClick={exportToExcel}
            >
              Export to Excel
            </Button>
            <Button variant="danger" onClick={exportToPDF}>
              Export to PDF
            </Button>
          </Container>
        </>
      )}
    </Container>
  );
}

export default App;