// src/components/SORSection.js

import React, { useState } from "react";
import {
  Row,
  Col,
  Form,
  Button,
  InputGroup,
} from "react-bootstrap";

// ─────────────────────────────────────────────────────────────────────
// Helper to parse a quantity string into an integer (default 0)
const parseQty = (val) => {
  const x = parseInt(val, 10);
  return isNaN(x) ? 0 : x;
};

// Helper to parse a string into a float (default 0)
const parseNum = (val) => {
  const x = parseFloat(val);
  return isNaN(x) ? 0 : x;
};

// Helper to title‐case a section name
const titleCase = (str) => {
  if (!str) return "";
  const s = str.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const SORSection = ({
  section,
  sors,
  onAddSOR,
  onUpdateSOR,
  onRemoveSOR,
}) => {
  // ─────────────────────────────────────────────────────────────────
  // 1) Local state for search + add additional SORs (standard SOR sections)
  const [searchText, setSearchText] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // ─────────────────────────────────────────────────────────────────
  // 2) Section‐specific controls (used only in kitchen / bathroom sections)
  const [kitchenMWR, setKitchenMWR] = useState("");
  const [showerFitted, setShowerFitted] = useState("");
  const [bathTurn, setBathTurn] = useState("");
  const [bathMWR, setBathMWR] = useState("");

  // ─────────────────────────────────────────────────────────────────
  // 3) Grab the array of already‐selected items for this section
  const selectedSORs = Array.isArray(sors?.[section]) ? sors[section] : [];

  // ─────────────────────────────────────────────────────────────────
  // 4) The global “searchable” SOR list (for standard SOR‐driven sections)
  // Combine the section-specific SORs and the global searchable list (including __search_only if present)
  const allSearchable = [
    ...(Array.isArray(sors?.[section]) ? sors[section] : []),
    ...(Array.isArray(sors?.__search_only) ? sors.__search_only : []),
    ...(Array.isArray(sors?.searchable) ? sors.searchable : [])
  ];
  // Log the list of available searchable codes for debugging
  console.log("Searchable codes (merged):", allSearchable.map(s => s.code));

  // 5) Filter “searchable” by searchText (multi-word, unordered matching on code/description)
  const filteredResults = allSearchable.filter((item) => {
    const terms = searchText.toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = `${item.code} ${item.description}`.toLowerCase();
    return terms.every(term => haystack.includes(term));
  });

  // ─────────────────────────────────────────────────────────────────
  // 6) Decide if this is a “free‐form” section (lorry clearance or contractor work)
  const isFreeFormSection =
    section === "lorry clearance" || section === "contractor work";

  // ─────────────────────────────────────────────────────────────────
  // 7) Render any section‐specific custom controls (unchanged)
  const renderCustomControls = () => {
    switch (section) {
      case "asbestos":
        return (
          <div className="mb-4">
            <Form.Label className="fw-medium">Asbestos Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Enter any asbestos‐related comments here"
            />
          </div>
        );

      case "loft":
        return (
          <div className="mb-4">
            <Row className="g-3">
              <Col md={6}>
                <Form.Label className="fw-medium">
                  Has the Loft been checked?
                </Form.Label>
                <div>
                  <Form.Check
                    inline
                    type="radio"
                    name={`loftChecked-${section}`}
                    id={`loftChecked-${section}-yes`}
                    value="yes"
                    label="Yes"
                  />
                  <Form.Check
                    inline
                    type="radio"
                    name={`loftChecked-${section}`}
                    id={`loftChecked-${section}-no`}
                    value="no"
                    label="No"
                  />
                </div>
              </Col>
              <Col md={6}>
                <Form.Label className="fw-medium">
                  Does the Loft need clearing?
                </Form.Label>
                <div>
                  <Form.Check
                    inline
                    type="radio"
                    name={`loftClear-${section}`}
                    id={`loftClear-${section}-yes`}
                    value="yes"
                    label="Yes"
                  />
                  <Form.Check
                    inline
                    type="radio"
                    name={`loftClear-${section}`}
                    id={`loftClear-${section}-no`}
                    value="no"
                    label="No"
                  />
                </div>
              </Col>
            </Row>
          </div>
        );

      case "kitchen":
        return (
          <div className="mb-4">
            <Row className="g-3">
              <Col md={3}>
                <Form.Label className="fw-medium">
                  Adequate space for cooker (300 mm either side)?
                </Form.Label>
                <Form.Check type="checkbox" label="Yes" />
              </Col>
              <Col md={3}>
                <Form.Label className="fw-medium">
                  Type of cooker point installed
                </Form.Label>
                <Form.Select>
                  <option value="">Select…</option>
                  <option>Gas</option>
                  <option>Electric</option>
                  <option>Both</option>
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label className="fw-medium">
                  Extractor fan fitted?
                </Form.Label>
                <Form.Select>
                  <option value="">Select…</option>
                  <option>Yes</option>
                  <option>No</option>
                  <option>N/A</option>
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label className="fw-medium">
                  Does this require a MWR?
                </Form.Label>
                <Form.Select
                  value={kitchenMWR}
                  onChange={(e) => setKitchenMWR(e.target.value)}
                >
                  <option value="">Select…</option>
                  <option>Yes</option>
                  <option>No</option>
                </Form.Select>
              </Col>
            </Row>
          </div>
        );

      case "bathroom/wetroom":
        return (
          <div className="mb-4">
            <Row className="g-3">
              <Col md={3}>
                <Form.Label className="fw-medium">Extractor fan fitted?</Form.Label>
                <Form.Select>
                  <option value="">Select…</option>
                  <option>Yes</option>
                  <option>No</option>
                  <option>N/A</option>
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label className="fw-medium">Shower fitted?</Form.Label>
                <Form.Select
                  value={showerFitted}
                  onChange={(e) => setShowerFitted(e.target.value)}
                >
                  <option value="">Select…</option>
                  <option>Yes</option>
                  <option>No</option>
                  <option>N/A</option>
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label className="fw-medium">Bath turn required?</Form.Label>
                <Form.Select
                  value={bathTurn}
                  onChange={(e) => setBathTurn(e.target.value)}
                >
                  <option value="">Select…</option>
                  <option>Yes</option>
                  <option>No</option>
                  <option>N/A</option>
                </Form.Select>
                {bathTurn === "Yes" && (
                  <p className="text-danger small mt-1">
                    Refurb survey required
                  </p>
                )}
              </Col>
              <Col md={3}>
                <Form.Label className="fw-medium">Does this require a MWR?</Form.Label>
                <Form.Select
                  value={bathMWR}
                  onChange={(e) => setBathMWR(e.target.value)}
                >
                  <option value="">Select…</option>
                  <option>Yes</option>
                  <option>No</option>
                </Form.Select>
              </Col>
            </Row>
          </div>
        );

      default:
        return null;
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // 8) Render a “free‐form” section for Lorry Clearance / Contractor Work
  // ─────────────────────────────────────────────────────────────────
  const renderFreeFormSection = () => {
    return (
      <div>
        {selectedSORs.map((item, idx) => {
          // Each free‐form item has:
          //   { contractor (for contractor work only),
          //     cost, timeEstimate, recharge, comment }
          // For lorry clearance, we treat 'comment' as “Item Description”
          const isLorry = section === "lorry clearance";
          const isContractor = section === "contractor work";

          return (
            <React.Fragment key={`${section}-${idx}`}>
              {/* ─── Row of inputs ─── */}
              <Row className="align-items-center mb-2">
                {isContractor && (
                  <Col md={3} className="mb-2 mb-md-0">
                    {/* Contractor Name */}
                    <Form.Control
                      type="text"
                      placeholder="Contractor"
                      value={item.contractor || ""}
                      onChange={(e) =>
                        onUpdateSOR(section, idx, {
                          ...item,
                          contractor: e.target.value,
                        })
                      }
                    />
                  </Col>
                )}

                {/* Cost */}
                <Col md={isContractor ? 2 : 3} className="mb-2 mb-md-0">
                  <Form.Control
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Cost"
                    value={item.cost || ""}
                    onChange={(e) =>
                      onUpdateSOR(section, idx, {
                        ...item,
                        cost: e.target.value,
                      })
                    }
                  />
                </Col>

                {/* Time Estimate (hrs) */}
                <Col md={isContractor ? 2 : 3} className="mb-2 mb-md-0">
                  <Form.Control
                    type="number"
                    min={0}
                    placeholder="Time (hrs)"
                    value={item.timeEstimate || ""}
                    onChange={(e) =>
                      onUpdateSOR(section, idx, {
                        ...item,
                        timeEstimate: e.target.value,
                      })
                    }
                  />
                </Col>

                {/* “Recharge?” checkbox */}
                <Col md={2} className="mb-2 mb-md-0">
                  <Form.Check
                    type="checkbox"
                    label="Recharge?"
                    checked={!!item.recharge}
                    onChange={(e) =>
                      onUpdateSOR(section, idx, {
                        ...item,
                        recharge: e.target.checked,
                      })
                    }
                  />
                </Col>

                {/* Delete Button */}
                <Col md={1} className="text-end">
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => onRemoveSOR(section, idx)}
                  >
                    ✕
                  </Button>
                </Col>
              </Row>

              {/* ─── Full‐width “Item Description” or “Comment” ─── */}
              <Row className="mb-3">
                <Col>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder={
                      isLorry ? "Item Description" : "Comment"
                    }
                    value={item.comment || ""}
                    onChange={(e) =>
                      onUpdateSOR(section, idx, {
                        ...item,
                        comment: e.target.value,
                      })
                    }
                  />
                </Col>
              </Row>
            </React.Fragment>
          );
        })}

        {/* ─── “Add New Free‐Form Item” button ─── */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            onAddSOR(section, {
              contractor: "",
              cost: "",
              timeEstimate: "",
              recharge: false,
              comment: "",
            })
          }
        >
          + Add{" "}
          {titleCase(
            section === "contractor work"
              ? "Contractor Item"
              : "Lorry Clearance Item"
          )}
        </Button>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────
  // 9) Render a “standard SOR” section (quantity, recharge, etc.)
  // ─────────────────────────────────────────────────────────────────
  const renderSORSection = () => {
    return (
      <>
        {/* a) Section‐specific custom controls */}
        {renderCustomControls()}

        {/* b) Default SORs for this section */}
        {selectedSORs.length > 0 && (
          <div>
            <p className="fw-semibold mb-2" style={{ display: "none" }}>Default SORs:</p>
            {selectedSORs.map((sor, idx) => {
              const currentQty = parseQty(sor.quantity);
              return (
                <Row
                  key={`${sor.code}-${idx}`}
                  className="align-items-center mb-3 pb-2 border-bottom"
                >
                  {/* 1) Description */}
                  <Col md={4} className="mb-2 mb-md-0">
                    <small className="fw-semibold">
                      {sor.description}
                    </small>
                  </Col>

                  {/* 2) Quantity Buttons */}
                  <Col md={3} className="mb-2 mb-md-0">
                    <InputGroup>
                      <Button
                        variant="outline-secondary"
                        onClick={() => {
                          const newQty = Math.max(currentQty - 1, 0);
                          onUpdateSOR(section, idx, {
                            ...sor,
                            quantity: newQty.toString(),
                          });
                        }}
                      >
                        −
                      </Button>
                      <Form.Control
                        type="number"
                        min={0}
                        value={currentQty}
                        onChange={(e) => {
                          const parsed = parseQty(e.target.value);
                          onUpdateSOR(section, idx, {
                            ...sor,
                            quantity: parsed.toString(),
                          });
                        }}
                        className="text-center"
                        style={{ maxWidth: "80px" }}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => {
                          const newQty = currentQty + 1;
                          onUpdateSOR(section, idx, {
                            ...sor,
                            quantity: newQty.toString(),
                          });
                        }}
                      >
                        +
                      </Button>
                    </InputGroup>
                  </Col>

                  {/* 3) UOM */}
                  <Col md={1} className="mb-2 mb-md-0">
                    <small>{sor.uom || "-"}</small>
                  </Col>

                  {/* 4) SMV & Cost */}
                  <Col md={2} className="mb-2 mb-md-0">
                    <small>
                      SMV: {sor.smv} | £{sor.cost.toFixed(2)}
                    </small>
                  </Col>

                  {/* 5) “Recharge?” checkbox */}
                  <Col md={1} className="mb-2 mb-md-0">
                    <Form.Check
                      type="checkbox"
                      label="Recharge?"
                      checked={!!sor.recharge}
                      onChange={(e) =>
                        onUpdateSOR(section, idx, {
                          ...sor,
                          recharge: e.target.checked,
                        })
                      }
                    />
                  </Col>

                  {/* 6) Comment */}
                  <Col md={11} className="mt-2">
                    <div className="sor-comment-wrapper">
                      <Form.Control
                        type="text"
                        placeholder="Comment"
                        className="form-control"
                        value={sor.comment || ""}
                        onChange={(e) => {
                          onUpdateSOR(section, idx, {
                            ...sor,
                            comment: e.target.value,
                          });
                        }}
                      />
                    </div>
                  </Col>
                </Row>
              );
            })}
          </div>
        )}

        {/* c) “Add Additional SORs” search + add */}
        <div className="mt-4">
          <div className="sor-search-wrapper">
            <Form.Control
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setShowSearchResults(true);
              }}
              placeholder="Search for additional SORs"
              className="form-control mb-2"
            />
          </div>

          {showSearchResults && searchText && (
            <div
              className="border rounded p-2"
              style={{ maxHeight: "200px", overflowY: "auto" }}
            >
              {filteredResults.map((sor, idx) => (
                <Row
                  key={`${sor.code}-search-${idx}`}
                  className="align-items-center mb-2"
                >
                  <Col md={9}>
                    <p className="mb-0 small">
                      <strong>{sor.code}</strong> — {sor.description}
                    </p>
                    <p className="text-muted small mb-0">
                      SMV: {sor.smv} | £{sor.cost.toFixed(2)} | {sor.uom || "-"}
                    </p>
                  </Col>
                  <Col md="auto">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => {
                        onAddSOR(section, {
                          code: sor.code,
                          description: sor.description,
                          uom: sor.uom,
                          smv: sor.smv,
                          cost: sor.cost,
                          quantity: "0",
                          comment: "",
                          recharge: false,
                        });
                        setShowSearchResults(false);
                        setSearchText("");
                      }}
                    >
                      Add
                    </Button>
                  </Col>
                </Row>
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div>
      {isFreeFormSection ? renderFreeFormSection() : renderSORSection()}
    </div>
  );
};

export default SORSection;