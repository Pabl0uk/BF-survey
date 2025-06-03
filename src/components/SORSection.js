// src/components/SORSection.js

import React, { useState } from "react";
import { Button, InputGroup, Form } from "react-bootstrap";

const SORSection = ({
  section,
  sors,
  onAddSOR,
  onUpdateSOR,
  onRemoveSOR,
}) => {
  // ——————————————————————————————
  // Top‐level state for search
  const [searchText, setSearchText] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // ——————————————————————————————
  // Section‐specific controlled fields:
  const [kitchenMWR, setKitchenMWR] = useState(""); // Kitchen “Does this require a MWR?”
  const [showerFitted, setShowerFitted] = useState(""); // Bathroom “Shower fitted?”
  const [bathTurn, setBathTurn] = useState(""); // Bathroom “Bath turn required?”
  const [bathMWR, setBathMWR] = useState(""); // Bathroom “Does this require a MWR?”

  // ——————————————————————————————
  // Safely read the array of already‐selected SORs for this section:
  const selectedSORs = Array.isArray(sors?.[section]) ? sors[section] : [];

  // Safely read the global searchable list (sors.searchable)
  const allSearchable = Array.isArray(sors?.searchable) ? sors.searchable : [];

  // Filtered results based on the user’s searchText
  const filteredResults = allSearchable.filter((item) =>
    item.description.toLowerCase().includes(searchText.toLowerCase())
  );

  // Helper to parse a quantity string into an integer (default 0)
  const parseQty = (val) => {
    const x = parseInt(val, 10);
    return isNaN(x) ? 0 : x;
  };

  // ——————————————————————————————
  // Render any section‐specific custom controls:
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

      case "lorry clearance":
        return (
          <div className="mb-4">
            <Form.Label className="fw-medium">Lorry Clearance Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Describe what needs clearing"
            />
          </div>
        );

      case "loft":
        return (
          <div className="mb-4 row g-3">
            <div className="col-md-6">
              <Form.Label className="fw-medium">Has the Loft been checked?</Form.Label>
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
            </div>
            <div className="col-md-6">
              <Form.Label className="fw-medium">Does the Loft need clearing?</Form.Label>
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
            </div>
          </div>
        );

      case "kitchen":
        return (
          <div className="mb-4 row g-3">
            <div className="col-md-3">
              <Form.Label className="fw-medium">
                Adequate space for cooker (300 mm either side)?
              </Form.Label>
              <Form.Check type="checkbox" label="Yes" />
            </div>
            <div className="col-md-3">
              <Form.Label className="fw-medium">Type of cooker point installed</Form.Label>
              <Form.Select>
                <option value="">Select…</option>
                <option>Gas</option>
                <option>Electric</option>
                <option>Both</option>
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="fw-medium">Extractor fan fitted?</Form.Label>
              <Form.Select>
                <option value="">Select…</option>
                <option>Yes</option>
                <option>No</option>
                <option>N/A</option>
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="fw-medium">Does this require a MWR?</Form.Label>
              <Form.Select
                value={kitchenMWR}
                onChange={(e) => setKitchenMWR(e.target.value)}
              >
                <option value="">Select…</option>
                <option>Yes</option>
                <option>No</option>
              </Form.Select>
            </div>
          </div>
        );

      case "bathroom/wetroom":
        return (
          <div className="mb-4 row g-3">
            <div className="col-md-3">
              <Form.Label className="fw-medium">Extractor fan fitted?</Form.Label>
              <Form.Select>
                <option value="">Select…</option>
                <option>Yes</option>
                <option>No</option>
                <option>N/A</option>
              </Form.Select>
            </div>
            <div className="col-md-3">
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
              {showerFitted === "No" && (
                <div className="mt-2">
                  <Form.Label className="fw-medium">Shower required?</Form.Label>
                  <Form.Select>
                    <option value="">Select…</option>
                    <option>Deck Mixer</option>
                    <option>Electric</option>
                  </Form.Select>
                </div>
              )}
            </div>
            <div className="col-md-3">
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
                <p className="text-danger small mt-1">Refurb survey required</p>
              )}
            </div>
            <div className="col-md-3">
              <Form.Label className="fw-medium">Does this require a MWR?</Form.Label>
              <Form.Select
                value={bathMWR}
                onChange={(e) => setBathMWR(e.target.value)}
              >
                <option value="">Select…</option>
                <option>Yes</option>
                <option>No</option>
              </Form.Select>
            </div>
          </div>
        );

      // ——— “Contractor Work” block, last in order ——
      case "contractor work":
        return (
          <div className="mb-4">
            <h6 className="fw-semibold mb-3">Contractor Work</h6>

            {selectedSORs.map((entry, idx) => (
              <div
                key={idx}
                className="mb-4 p-3 border rounded bg-light position-relative"
              >
                {/* Delete button in the top-right corner */}
                <Button
                  variant="outline-danger"
                  size="sm"
                  className="position-absolute top-0 end-0 m-2"
                  onClick={() => onRemoveSOR(section, idx)}
                >
                  ×
                </Button>

                <Form.Group className="mb-2">
                  <Form.Label>Contractor Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={entry.contractor || ""}
                    placeholder="e.g. Acme Plumbing"
                    onChange={(e) =>
                      onUpdateSOR(section, idx, {
                        ...entry,
                        contractor: e.target.value,
                      })
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Estimated Cost</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={entry.estCost || ""}
                    placeholder="£"
                    onChange={(e) =>
                      onUpdateSOR(section, idx, {
                        ...entry,
                        estCost: e.target.value,
                      })
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Comments</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={entry.comment || ""}
                    placeholder="Any notes about this job…"
                    onChange={(e) =>
                      onUpdateSOR(section, idx, {
                        ...entry,
                        comment: e.target.value,
                      })
                    }
                  />
                </Form.Group>
              </div>
            ))}

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const newEntry = { contractor: "", estCost: "", comment: "" };
                onAddSOR(section, newEntry);
                setShowSearchResults(false);
                setSearchText("");
              }}
            >
              + Add Contractor Job
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mb-5">
      {/* 1) Section‐specific custom controls */}
      {renderCustomControls()}

      {/* 2) Default SORs for non‐“contractor work” */}
      {section !== "contractor work" && selectedSORs.length > 0 && (
        <div>
          <p className="fw-medium mb-2">Default SORs:</p>
          {selectedSORs.map((sor, idx) => {
            const currentQty = parseQty(sor.quantity);
            return (
              <div
                key={`${sor.code}-${idx}`}
                className="row align-items-center mb-3 pb-2 border-bottom"
              >
                {/* 2a) Description */}
                <div className="col-12 col-md-4 mb-2 mb-md-0">
                  <small className="fw-semibold">{sor.description}</small>
                </div>

                {/* 2b) Plus/Minus Quantity */}
                <div className="col-12 col-md-4 mb-2 mb-md-0">
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
                        const val = e.target.value;
                        const parsed = parseQty(val);
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
                </div>

                {/* 2c) UOM */}
                <div className="col-6 col-md-2 mb-2 mb-md-0">
                  <small>{sor.uom || "-"}</small>
                </div>

                {/* 2d) SMV & Cost */}
                <div className="col-6 col-md-2 mb-2 mb-md-0">
                  <small>
                    SMV: {sor.smv} | £{sor.cost.toFixed(2)}
                  </small>
                </div>

                {/* 2e) Comment box */}
                <div className="col-12 mt-2">
                  <Form.Control
                    type="text"
                    placeholder="Comment"
                    value={sor.comment || ""}
                    onChange={(e) =>
                      onUpdateSOR(section, idx, {
                        ...sor,
                        comment: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3) Search + Add Additional SORs (skip if “contractor work”) */}
      {section !== "contractor work" && (
        <div className="mt-4">
          <Form.Control
            type="text"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setShowSearchResults(true);
            }}
            placeholder="Search for additional SORs"
            className="mb-2"
          />

          {showSearchResults && searchText && (
            <div
              className="border rounded p-2"
              style={{ maxHeight: "200px", overflowY: "auto" }}
            >
              {filteredResults.map((sor, idx) => (
                <div
                  key={`${sor.code}-search-${idx}`}
                  className="d-flex justify-content-between align-items-center mb-2"
                >
                  <div>
                    <p className="mb-0 small">{sor.description}</p>
                    <p className="text-muted small mb-0">
                      SMV: {sor.smv} | £{sor.cost.toFixed(2)} | {sor.uom || "-"}
                    </p>
                  </div>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => {
                      onAddSOR(section, sor);
                      setShowSearchResults(false);
                      setSearchText("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SORSection;