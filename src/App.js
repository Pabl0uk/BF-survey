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
} from "react-bootstrap";
import SORSection from "./components/SORSection";
import "./index.css";

// Fixed list of desired sections; “contractor work” stays last
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

// Helper to convert “kitchen” → “Kitchen”
const titleCase = (str) => {
  if (!str) return "";
  const s = str.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function App() {
  const [sors, setSors] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [surveyorName, setSurveyorName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");

  // Summary‐row state
  const [voidRating, setVoidRating] = useState("Green");
  const [voidType, setVoidType] = useState("Minor");
  const [overallComments, setOverallComments] = useState("");
  const [mwrRequired, setMWRRequired] = useState(false);

  // Load sors.json at mount
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

  // Safely parse numbers
  const parseNum = (val) => {
    const x = parseFloat(val);
    return isNaN(x) ? 0 : x;
  };

  // Compute totals
  const computeTotals = () => {
    let totalSMV = 0;
    let totalCost = 0;

    Object.keys(sors).forEach((sectionKey) => {
      if (sectionKey === "searchable") return;
      sors[sectionKey].forEach((sor) => {
        const qty = parseNum(sor.quantity || 0);
        totalSMV += parseNum(sor.smv) * qty;
        totalCost += parseNum(sor.cost) * qty;
      });
    });

    const rawDays = totalSMV / 450; // 450 SMV = 1 day
    return {
      smv: Math.round(totalSMV),
      cost: totalCost.toFixed(2),
      daysDecimal: rawDays,
    };
  };

  const totals = computeTotals();
  const sectionKeys = desiredOrder.filter((key) => key in sors);

  // Add / update / remove handlers
  const handleAddSOR = (section, newSOR) => {
    setSors((prev) => {
      const arr = Array.isArray(prev[section]) ? prev[section] : [];
      return { ...prev, [section]: [...arr, newSOR] };
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

  //
  // ─────────────────────────────────────────────────────────────────────
  //   E X P O R T   T O   E X C E L
  // ─────────────────────────────────────────────────────────────────────
  //
  const exportToExcel = () => {
    const XLSX = require("xlsx");

    // Build Summary AoA
    const aoa = [
      ["Surveyor Name", surveyorName],
      ["Property Address", propertyAddress],
      ["Void Rating", voidRating],
      ["Void Type", voidType],
      ["MWR Required", mwrRequired ? "Yes" : "No"],
      ["Total SMV", totals.smv],
      ["Total Void Days", totals.daysDecimal.toFixed(1)],
      ["Total Cost (£)", totals.cost],
      ["Comments", overallComments],
    ];

    // Append Contractor Work if any
    const contractors = sors["contractor work"] || [];
    if (contractors.length > 0) {
      aoa.push([]); // blank row
      aoa.push(["Contractor", "Description", "Cost"]);
      contractors.forEach((cw) => {
        aoa.push([
          cw.contractor || "",
          cw.description || "",
          cw.cost || "",
        ]);
      });
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
        "Cost",
        "Comment",
      ],
    ];
    sectionKeys.forEach((section) => {
      if (section === "searchable" || section === "contractor work") return;
      sors[section].forEach((sor) => {
        detailsAoA.push([
          titleCase(section),
          sor.code || "",
          sor.description || "",
          sor.uom || "",
          sor.quantity || "",
          sor.smv || "",
          sor.cost || "",
          sor.comment || "",
        ]);
      });
    });
    const wsDetails = XLSX.utils.aoa_to_sheet(detailsAoA);

    // Create and write workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    XLSX.utils.book_append_sheet(wb, wsDetails, "SOR Details");

    const safeAddr = propertyAddress.replace(/\s+/g, "_");
    XLSX.writeFile(wb, `Empty_Homes_Survey_${safeAddr}.xlsx`);
  };

  //
  // ─────────────────────────────────────────────────────────────────────
  //   E X P O R T   T O   P D F
  // ─────────────────────────────────────────────────────────────────────
  //
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
      ["Total SMV:", totals.smv.toString()],
      ["Total Cost (£):", totals.cost.toString()],
      ["Total Void Days:", totals.daysDecimal.toFixed(1)],
      ["Comments:", overallComments],
    ];
    summaryLines.forEach((pair) => {
      doc.text(`${pair[0]} ${pair[1]}`, 40, y);
      y += 16;
    });
    y += 10;

    // Contractor Work (if any)
    const contractors = sors["contractor work"] || [];
    if (contractors.length > 0) {
      doc.autoTable({
        startY: y,
        head: [["Contractor", "Description", "Cost"]],
        body: contractors.map((cw) => [
          cw.contractor || "",
          cw.description || "",
          cw.cost || "",
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [240, 240, 240] },
      });
      y = doc.lastAutoTable.finalY + 20;
    }

    // SOR Details table
    const detailRows = [];
    sectionKeys.forEach((section) => {
      if (section === "searchable" || section === "contractor work") return;
      sors[section].forEach((sor) => {
        detailRows.push([
          titleCase(section),
          sor.code || "",
          sor.description || "",
          sor.uom || "",
          sor.quantity || "",
          sor.smv || "",
          sor.cost || "",
          sor.comment || "",
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
          "Cost",
          "Comment",
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
          <div className="d-none d-md-block sticky-top bg-white shadow-sm" style={{ zIndex: 1020 }}>
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
                <Col xs={6} md={3}>
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
                <Col xs={6} md={3}>
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
                        Days
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

          {/* ─── Spacing to push content below sticky header on md+ ─── */}
          <div style={{ height: "30px" }}></div>
          {/* 150px roughly matches the combined height of the logo/name + cards on md+ */}

          {/* ─── Main Form Sections ─── */}
          <Container fluid className="px-4">
            <Accordion defaultActiveKey="none" flush>
              {sectionKeys.map((section) => (
                <Accordion.Item
                  eventKey={section}
                  key={section}
                  className="mb-3"
                >
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

              {/* Final “Comments” */}
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

          {/* ─── Export Buttons (at bottom) ─── */}
          <Container fluid className="px-4 mt-4 mb-5 text-center">
            <Button variant="success" className="me-3" onClick={exportToExcel}>
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