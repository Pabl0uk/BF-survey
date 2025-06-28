// src/App.js
import React, { useEffect, useState, useRef } from "react";
import { debounce } from "lodash";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
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
  Alert,
} from "react-bootstrap";
import SORSection from "./components/SORSection";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import "./index.css";

import { getFirestore, collection, addDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import firebaseConfig from "./lib/firebase";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

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
  // Loft checkboxes states
  const [loftChecked, setLoftChecked] = useState("");
  const [loftNeedsClearing, setLoftNeedsClearing] = useState("");
  const [hasSavedSurvey, setHasSavedSurvey] = useState(false);
  // Kitchen and Bathroom MWR states
  const [kitchenMWR, setKitchenMWR] = useState("");
  const [bathMWR, setBathMWR] = useState("");
  // Asbestos Notes state
  const [asbestosNotes, setAsbestosNotes] = useState("");
  // Contractor and Lorry Clearance Notes states
  const [contractorNotes, setContractorNotes] = useState("");
  const [lorryClearanceNotes, setLorryClearanceNotes] = useState("");
  // Gifted Items Notes state
  const [giftedItemsNotes, setGiftedItemsNotes] = useState("");
  // ──────────────────────────────────────────────────────────
  // Handler: Import Excel
  // ──────────────────────────────────────────────────────────
  // Kitchen & bathroom UI state hooks (dummy initial states here, replace as needed)
  const [cookerClearance, setCookerClearance] = useState("");
  const [cookerPointType, setCookerPointType] = useState("");
  const [extractorFan, setExtractorFan] = useState("");
  const [showerFitted, setShowerFitted] = useState("");
  const [showerType, setShowerType] = useState("");
  const [bathTurn, setBathTurn] = useState("");
  const [needsRefurbSurvey, setNeedsRefurbSurvey] = useState(false);
  const [bathTurnReminder, setBathTurnReminder] = useState(""); // for showing reminder text

  // Show Resume button immediately if a saved survey exists
  useEffect(() => {
    if (localStorage.getItem("surveyDraft")) {
      setHasSavedSurvey(true);
    }
  }, []);

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: "binary" });

      // Load Summary sheet
      const summarySheet = workbook.Sheets["Summary"];
      if (summarySheet) {
        const summary = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });
        summary.forEach(([label, value]) => {
          if (label === "Surveyor Name") setSurveyorName(value);
          if (label === "Property Address") setPropertyAddress(value);
          if (label === "Void Rating") setVoidRating(value);
          if (label === "Void Type") setVoidType(value);
          if (label === "MWR Required") setMWRRequired(value === "Yes");
          // Import overall property comments from correct label
          if (label === "Overall Survey Comments") setOverallComments(value);
          // Gifted Items Notes
          if (label === "Gifted Items Notes") setGiftedItemsNotes(value);
          // Kitchen & bathroom-specific UI state from Summary sheet
          if (label === "Cooker Clearance OK?") setCookerClearance(value);
          if (label === "Cooker Point Type") setCookerPointType(value);
          if (label === "Extractor Fan Fitted?") setExtractorFan(value);
          if (label === "Shower Fitted?") setShowerFitted(value);
          if (label === "Shower Required") setShowerType(value);
          if (label === "Bath Turn Required?") {
            setBathTurn(value);
            if (value === "Yes") {
              setBathTurnReminder("Bath turn required: Please arrange a refurb survey.");
              setNeedsRefurbSurvey(true);
            } else {
              setBathTurnReminder("");
              setNeedsRefurbSurvey(false);
            }
          }
          if (label === "Kitchen MWR?") setKitchenMWR(value);
          if (label === "Bathroom MWR?") setBathMWR(value);
          // Asbestos Notes
          if (label === "Asbestos Notes") setAsbestosNotes(value);
          // Contractor and Lorry Clearance Notes
          if (label === "Contractor Notes") setContractorNotes(value);
          if (label === "Lorry Clearance Notes") setLorryClearanceNotes(value);
          // Loft checkboxes
          if (label === "Loft Checked?") setLoftChecked(value === "Yes");
          if (label === "Loft Needs Clearing?") setLoftNeedsClearing(value === "Yes");
        });
      }

      // Load SOR Details sheet
      const detailsSheet = workbook.Sheets["SOR Details"];
      if (detailsSheet) {
        const details = XLSX.utils.sheet_to_json(detailsSheet, { defval: "" });
        const updatedSors = {};
        // Prepare arrays for each section
        desiredOrder.forEach((section) => {
          updatedSors[section] = [];
        });

        details.forEach((row) => {
          const section = (row["Section"] || "").trim().toLowerCase();

          if (section === "contractor work") {
            if (!updatedSors["contractor work"]) updatedSors["contractor work"] = [];
            updatedSors["contractor work"].push({
              contractor: row["Contractor"] || "",
              cost: row["Cost (£)"] || "",
              timeEstimate: row["Time (hrs)"] || "",
              recharge: row["Recharge?"] === "Yes",
              comment: row["Comment"] || "",
              description: row["Description"] || row["Comment"] || "",
            });
            return;
          }

          if (section === "lorry clearance") {
            if (!updatedSors["lorry clearance"]) updatedSors["lorry clearance"] = [];
            updatedSors["lorry clearance"].push({
              cost: row["Cost (£)"] || "",
              timeEstimate: row["Time (hrs)"] || "",
              recharge: row["Recharge?"] === "Yes",
              comment: row["Comment"] || "",
              description: row["Description"] || row["Comment"] || "",
            });
            return;
          }

          if (!(section in updatedSors)) return;

          updatedSors[section].push({
            code: row["Code"],
            description: row["Description"],
            uom: row["UOM"],
            quantity: row["Quantity"],
            smv: row["SMV"],
            cost: row["Cost (£)"],
            comment: row["Comment"],
            recharge: row["Recharge?"] === "Yes",
          });
        });

        setSors((prev) => {
          const merged = { ...prev };
          Object.keys(updatedSors).forEach((section) => {
            const importList = updatedSors[section];
            const originalList = Array.isArray(prev[section]) ? [...prev[section]] : [];

            // For contractor work and lorry clearance, override with importList
            if (section === "contractor work" || section === "lorry clearance") {
              merged[section] = importList;
              return;
            }

            // For all other sections, merge as before
            const updatedList = originalList.map((originalItem) => {
              const match = importList.find((row) => row.code === originalItem.code);
              if (!match) return originalItem;
              return {
                ...originalItem,
                quantity: match.quantity,
                comment: match.comment,
                recharge: match.recharge,
              };
            });

            // Append any unmatched imported rows (manually added)
            importList.forEach((row) => {
              if (!updatedList.some((i) => i.code === row.code)) {
                updatedList.push(row);
              }
            });

            merged[section] = updatedList;
          });
          return merged;
        });
      }
    };
    reader.readAsBinaryString(file);
  };
  // ──────────────────────────────────────────────────────────
  // State: All sections (arrays of SOR rows or free‐form rows)
  // ──────────────────────────────────────────────────────────
  const [sors, setSors] = useState({});

  // ──────────────────────────────────────────────────────────
  // State: Dark mode
  // ──────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("darkMode") === "true"
  );

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  // ──────────────────────────────────────────────────────────
  // State: Did the user click “Start Survey”?
  // ──────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);

  // ──────────────────────────────────────────────────────────
  // Accordion: Track active section and refs to scroll into view
  // ──────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState(null);
  const accordionRefs = useRef({});

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
        merged.__search_only = Array.isArray(data.__search_only)
          ? data.__search_only
          : [];
        // Remove any phantom placeholder from lorry clearance on load (stricter filter)
        if (Array.isArray(merged["lorry clearance"])) {
          merged["lorry clearance"] = merged["lorry clearance"].filter((item) => {
            // Enhanced skip condition for phantom default item
            const isRealSOR = item.code !== undefined;
            const isMeaningfulFreeform =
              (item.description && item.description.trim() !== "") ||
              (item.comment && item.comment.trim() !== "") ||
              (item.timeEstimate && item.timeEstimate.trim() !== "") ||
              parseNum(item.cost) !== 2500;
            return isRealSOR || isMeaningfulFreeform;
          });
        }
        setSors(merged);
      })
      .catch((err) => console.error("Failed to load sors.json", err));
  }, []);

  // ──────────────────────────────────────────────────────────
  // Restore from localStorage (auto-restore on mount, prevent duplicate prompts)
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const alreadyPrompted = sessionStorage.getItem("resumePrompted");
    const saved = localStorage.getItem("surveyDraft");

    if (!alreadyPrompted && saved) {
      sessionStorage.setItem("resumePrompted", "true");
      setHasSavedSurvey(true);
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // Auto-save to localStorage whenever any relevant state changes (debounced)
  // Only runs after user has started the survey (showForm === true)
  // ──────────────────────────────────────────────────────────
    useEffect(() => {
      if (!showForm) return;

      const debouncedSave = debounce(() => {
        const stateToSave = {
          surveyorName,
          propertyAddress,
          voidRating,
          voidType,
          overallComments,
          mwrRequired,
          sors,
          cookerClearance,
          cookerPointType,
          extractorFan,
          showerFitted,
          showerType,
          bathTurn,
          kitchenMWR,
          bathMWR,
          bathTurnReminder,
          needsRefurbSurvey,
          asbestosNotes,
          contractorNotes,
          lorryClearanceNotes,
          loftChecked,
          loftNeedsClearing,
          giftedItemsNotes,
        };

        localStorage.setItem("surveyDraft", JSON.stringify(stateToSave));
      }, 300);

      debouncedSave();

      return () => debouncedSave.cancel();
    }, [
      showForm, // now included as a dependency
      surveyorName, propertyAddress, voidRating, voidType, overallComments, mwrRequired, sors,
      cookerClearance, cookerPointType, extractorFan, showerFitted, showerType, bathTurn,
      kitchenMWR, bathMWR, bathTurnReminder, needsRefurbSurvey,
      asbestosNotes, contractorNotes, lorryClearanceNotes,
      loftChecked, loftNeedsClearing,
      giftedItemsNotes
    ]);

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
      // Skip phantom default item if all fields are empty
      if (
        arr.length === 1 &&
        !arr[0].code &&
        !arr[0].description &&
        !arr[0].cost &&
        !arr[0].quantity
      ) {
        return;
      }

      arr.forEach((item) => {
        // Determine if this is a free‐form “lorry clearance” or “contractor work” row
        const isFreeForm =
          (sectionKey === "lorry clearance" || sectionKey === "contractor work") &&
          !item.code;

        if (isFreeForm) {
          // Enhanced skip condition: skip default items unless user interacts
          if (
            item.default &&
            !item.description &&
            !item.comment &&
            !item.timeEstimate
          ) {
            return;
          }
          // Skip phantom free-form item if all fields are empty
          if (
            !item.description &&
            !item.cost &&
            !item.timeEstimate &&
            !item.comment
          ) {
            return;
          }
          // Additional skip condition for phantom £2500 row
          if (
            (!item.description || item.description.trim() === "") &&
            parseNum(item.cost) === 2500 &&
            (!item.timeEstimate || item.timeEstimate.trim() === "") &&
            (!item.comment || item.comment.trim() === "")
          ) {
            return;
          }
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
          // Regular SOR row: Only process if quantity > 0
          const quantity = parseNum(item.quantity || 0);
          const smv = parseNum(item.smv) * quantity;
          const cost = parseNum(item.cost) * quantity;

          if (quantity > 0) {
            // 1) Cost always goes into voidCost
            totalVoidCost += cost;

            if (item.recharge) {
              // 2a) Flagged recharge → add to both void & recharge
              totalRechargeCost += cost;
              totalRechargeSMV += smv;
            }
            // Add SMV to void regardless of recharge
            totalVoidSMV += smv;
          }
        }
      });
    });

    const voidDaysDecimal = totalVoidSMV / 400;
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

  const handleUpdateSOR = (section, idx, updatedSOR, field, value) => {
    // Early return logic for custom kitchen and bathroom fields to ensure state updates
    if (section === "__kitchen_ui__") {
      if (field === "cookerClearance") return setCookerClearance(value);
      if (field === "cookerPointType") return setCookerPointType(value);
      if (field === "kitchenMWR") return setKitchenMWR(value);
      if (field === "extractorFan") return setExtractorFan(value);
    }

    if (section === "__bathroom_ui__") {
      if (field === "extractorFan") return setExtractorFan(value);
      if (field === "showerFitted") {
        setShowerFitted(value);
        if (value === "Yes") {
          setShowerType("");
        }
        return;
      }
      if (field === "showerType") return setShowerType(value);
      if (field === "bathTurn") {
        setBathTurn(value);
        if (value === "Yes") {
          setNeedsRefurbSurvey(true);
          setBathTurnReminder("Bath turn required: Please arrange a refurb survey.");
        } else {
          setNeedsRefurbSurvey(false);
          setBathTurnReminder("");
        }
        return;
      }
      if (field === "bathMWR") return setBathMWR(value);
    }
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
      ["Overall Survey Comments", overallComments],
    ];
    // Add Gifted Items Notes before pushing kitchen/bathroom fields
    aoa.push(["Gifted Items Notes", giftedItemsNotes]);

    // Add import compatibility fields for kitchen and bathroom
    aoa.push(["Cooker Clearance OK?", cookerClearance]);
    aoa.push(["Cooker Point Type", cookerPointType]);
    aoa.push(["Extractor Fan Fitted?", extractorFan]);
    aoa.push(["Shower Fitted?", showerFitted]);
    aoa.push(["Shower Required", showerType]);
    aoa.push(["Bath Turn Required?", bathTurn]);
    aoa.push(["Kitchen MWR?", kitchenMWR]);
    aoa.push(["Bathroom MWR?", bathMWR]);
    // Asbestos Notes
    aoa.push(["Asbestos Notes", asbestosNotes]);
    // Contractor and Lorry Clearance Notes
    aoa.push(["Contractor Notes", contractorNotes]);
    aoa.push(["Lorry Clearance Notes", lorryClearanceNotes]);
    // Loft checkboxes
    aoa.push(["Loft Checked?", loftChecked ? "Yes" : "No"]);
    aoa.push(["Loft Needs Clearing?", loftNeedsClearing ? "Yes" : "No"]);

    // Helper for contractor/lorry rows
    const freeForms = (sectionKey) =>
      (sors[sectionKey] || []).map((row) => [
        row.description || row.contractor || "",
        row.cost || "",
        row.timeEstimate || "",
        row.recharge ? "Yes" : "No",
        row.comment || "",
      ]);

    // Insert contractor rows after summary fields
    const contractorRows = freeForms("contractor work");
    if (contractorRows.length > 0) {
      aoa.push([]);
      aoa.push([
        "Contractor",
        "Cost (£)",
        "Time (hrs)",
        "Recharge?",
        "Comment",
      ]);
      contractorRows.forEach((r) => aoa.push(r));
    }

    // Insert lorry clearance rows after contractor rows
    const lorryRows = (sors["lorry clearance"] || [])
      .filter((item) => {
        if (item.code) {
          // Dropdown SOR: Only include if quantity > 0 or comment exists
          return parseNum(item.quantity) > 0 || item.comment?.trim();
        } else {
          // Freeform row: Include if any relevant field has been filled
          return (
            item.description?.trim() ||
            item.comment?.trim() ||
            parseNum(item.cost) > 0 ||
            parseNum(item.timeEstimate) > 0
          );
        }
      })
      .map((row) => [
        row.description || row.contractor || "",
        row.cost || "",
        row.timeEstimate || "",
        row.recharge ? "Yes" : "No",
        row.comment || "",
      ]);
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
    wsSummary["!cols"] = [{ wch: 25 }, { wch: 40 }];

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
        "Recharge Type",
        "Time (hrs)",
        "Contractor",
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
        const quantity = parseNum(sor.quantity || 0);
        if (quantity > 0) {
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
            sor.recharge ? "SOR" : "",
            "", // Time
            "", // Contractor
          ]);
        }
      });
    });
    // Append contractor work to SOR Details (with time and contractor columns)
    (sors["contractor work"] || []).forEach((item) => {
      detailsAoA.push([
        "contractor work",
        "",
        item.description || "",
        "",
        "",
        "",
        item.cost || "",
        item.comment || "",
        item.recharge ? "Yes" : "No",
        item.recharge ? "Contractor" : "",
        item.timeEstimate || "",
        item.contractor || "",
      ]);
    });
    // Append lorry clearance to SOR Details (with time column), handling dropdown SOR vs freeform
    (sors["lorry clearance"] || [])
      .filter((item) => {
        if (item.code) {
          // Dropdown SOR: Only include if quantity > 0 or comment exists
          return parseNum(item.quantity) > 0 || item.comment?.trim();
        } else {
          // Freeform row: Include if any relevant field has been filled
          return (
            item.description?.trim() ||
            item.comment?.trim() ||
            parseNum(item.cost) > 0 ||
            parseNum(item.timeEstimate) > 0
          );
        }
      })
      .forEach((item) => {
        detailsAoA.push([
          "lorry clearance",
          item.code || "",
          item.description || "",
          item.uom || "",
          item.quantity || "",
          item.smv || "",
          item.cost || "",
          item.comment || "",
          item.recharge ? "Yes" : "No",
          item.recharge ? "Lorry" : "",
          item.timeEstimate || "",
          "", // Contractor column blank for lorry clearance
        ]);
      });
    const wsDetails = XLSX.utils.aoa_to_sheet(detailsAoA);
    // Set column widths for SOR Details for better formatting
    wsDetails["!cols"] = [
      { wch: 15 }, // Section
      { wch: 10 }, // Code
      { wch: 40 }, // Description
      { wch: 8 },  // UOM
      { wch: 8 },  // Quantity
      { wch: 8 },  // SMV
      { wch: 10 }, // Cost
      { wch: 30 }, // Comment
      { wch: 10 }, // Recharge
      { wch: 15 }, // Recharge Type
      { wch: 10 }, // Time (hrs)
      { wch: 18 }, // Contractor
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    XLSX.utils.book_append_sheet(wb, wsDetails, "SOR Details");

    const safeAddr = propertyAddress.replace(/\s+/g, "_");
    XLSX.writeFile(wb, `Empty_Homes_Survey_${safeAddr}.xlsx`);
  };

  // ──────────────────────────────────────────────────────────
  // Generate PDF Blob (for export/download)
  // ──────────────────────────────────────────────────────────
  const generatePDFBlob = () => {
    return new Promise((resolve) => {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      let y = 40;

      doc.setFontSize(18);
      doc.text("Empty Homes Survey", 40, y);
      y += 30;

      doc.setFontSize(12);
      doc.text(`Address: ${propertyAddress}`, 40, y);
      y += 20;

      doc.setFontSize(11);
      const summaryLines = [
        ["Surveyor Name:", surveyorName],
        ["Property Address:", propertyAddress],
        ["Void Rating:", voidRating],
        ["Void Type:", voidType],
        ["MWR Required:", mwrRequired ? "Yes" : "No"],
        ["Comments:", overallComments],
      ];
      summaryLines.forEach((pair) => {
        doc.text(`${pair[0]} ${pair[1]}`, 40, y);
        y += 16;
      });
      y += 10;

      const contractors = sors["contractor work"] || [];
      if (contractors.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Contractor Description", "Cost (£)", "Time (hrs)", "Recharge?", "Comment"]],
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

      const lorries = (sors["lorry clearance"] || []).filter((item) => {
        if (item.code) {
          return parseNum(item.quantity) > 0 || item.comment?.trim();
        } else {
          return (
            item.description?.trim() ||
            item.comment?.trim() ||
            parseNum(item.cost) > 0 ||
            parseNum(item.timeEstimate) > 0
          );
        }
      });
      if (lorries.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Lorry Clearance Description", "Cost (£)", "Time (hrs)", "Recharge?", "Comment"]],
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

      const detailRows = [];
      sectionKeys.forEach((section) => {
        if (section === "searchable" || section === "contractor work" || section === "lorry clearance") return;
        (sors[section] || []).forEach((sor) => {
          if (parseNum(sor.quantity) > 0) {
            detailRows.push([
              titleCase(section),
              sor.code || "",
              sor.description || "",
              sor.quantity || "",
              sor.comment || "",
            ]);
          }
        });
      });

      autoTable(doc, {
        startY: y,
        head: [["Section", "Code", "Description", "Quantity", "Comment"]],
        body: detailRows,
        styles: { fontSize: 9, cellWidth: 'wrap' },
        headStyles: { fillColor: [240, 240, 240] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 'auto' },
        },
        margin: { left: 40, right: 20 }
      });

      resolve(doc.output("blob"));
    });
  };

  // Optional: manual PDF export button
  const exportToPDF = async () => {
    const pdfBlob = await generatePDFBlob();
    const safeAddr = propertyAddress.replace(/\s+/g, "_");
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `Empty_Homes_Survey_${safeAddr}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  // ──────────────────────────────────────────────────────────
  // Export to Excel + PDF as ZIP (Export All)
  // ──────────────────────────────────────────────────────────
  const exportToZip = async () => {
    const zip = new JSZip();

    // 1. Generate Excel blob (with both Summary and SOR Details sheets)
    const excelBlob = await new Promise((resolve) => {
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
        ["Overall Survey Comments", overallComments],
        ["Gifted Items Notes", giftedItemsNotes],
        ["Cooker Clearance OK?", cookerClearance],
        ["Cooker Point Type", cookerPointType],
        ["Extractor Fan Fitted?", extractorFan],
        ["Shower Fitted?", showerFitted],
        ["Shower Required", showerType],
        ["Bath Turn Required?", bathTurn],
        ["Kitchen MWR?", kitchenMWR],
        ["Bathroom MWR?", bathMWR],
        ["Asbestos Notes", asbestosNotes],
        ["Contractor Notes", contractorNotes],
        ["Lorry Clearance Notes", lorryClearanceNotes],
        ["Loft Checked?", loftChecked ? "Yes" : "No"],
        ["Loft Needs Clearing?", loftNeedsClearing ? "Yes" : "No"],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(aoa);
      wsSummary["!cols"] = [{ wch: 25 }, { wch: 40 }];

      // SOR Details
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
          "Recharge Type",
          "Time (hrs)",
          "Contractor",
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
          const quantity = parseNum(sor.quantity || 0);
          if (quantity > 0) {
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
              sor.recharge ? "SOR" : "",
              "", // Time
              "", // Contractor
            ]);
          }
        });
      });
      (sors["contractor work"] || []).forEach((item) => {
        detailsAoA.push([
          "contractor work",
          "",
          item.description || "",
          "",
          "",
          "",
          item.cost || "",
          item.comment || "",
          item.recharge ? "Yes" : "No",
          item.recharge ? "Contractor" : "",
          item.timeEstimate || "",
          item.contractor || "",
        ]);
      });
      (sors["lorry clearance"] || [])
        .filter((item) => {
          if (item.code) {
            return parseNum(item.quantity) > 0 || item.comment?.trim();
          } else {
            return (
              item.description?.trim() ||
              item.comment?.trim() ||
              parseNum(item.cost) > 0 ||
              parseNum(item.timeEstimate) > 0
            );
          }
        })
        .forEach((item) => {
          detailsAoA.push([
            "lorry clearance",
            item.code || "",
            item.description || "",
            item.uom || "",
            item.quantity || "",
            item.smv || "",
            item.cost || "",
            item.comment || "",
            item.recharge ? "Yes" : "No",
            item.recharge ? "Lorry" : "",
            item.timeEstimate || "",
            "", // Contractor
          ]);
        });

      const wsDetails = XLSX.utils.aoa_to_sheet(detailsAoA);
      wsDetails["!cols"] = [
        { wch: 15 },
        { wch: 10 },
        { wch: 40 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
        { wch: 30 },
        { wch: 10 },
        { wch: 15 }, // Recharge Type
        { wch: 10 },
        { wch: 18 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
      XLSX.utils.book_append_sheet(wb, wsDetails, "SOR Details");

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      resolve(new Blob([wbout], { type: "application/octet-stream" }));
    });

    // 2. Generate PDF blob
    const pdfBlob = await generatePDFBlob();

    // 3. Add both to zip
    const safeAddr = propertyAddress.replace(/\s+/g, "_");
    zip.file(`Empty_Homes_Survey_${safeAddr}.xlsx`, excelBlob);
    zip.file(`Empty_Homes_Survey_${safeAddr}.pdf`, pdfBlob);

    // 4. Trigger zip download
    zip.generateAsync({ type: "blob" }).then(async (content) => {
      // Send data to dashboard API
      try {
        await fetch("https://voids-dashboard.vercel.app/api/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            surveyorName,
            propertyAddress,
            address: propertyAddress,
            voidRating,
            voidType,
            mwrRequired,
            overallComments,
            totals,
            giftedItemsNotes,
            cookerClearance,
            cookerPointType,
            extractorFan,
            showerFitted,
            showerType,
            bathTurn,
            kitchenMWR,
            bathMWR,
            asbestosNotes,
            contractorNotes,
            lorryClearanceNotes,
            loftChecked,
            loftNeedsClearing,
            sors: Object.fromEntries(
              Object.entries(sors).map(([section, items]) => {
                const filtered = (items || []).filter((item) => {
                  const quantity = parseFloat(item.quantity || 0);
                  const hasComment = item.comment?.trim();
                  const isRecharge = item.recharge === true;

                  if (section === "lorry clearance") {
                    if (item.code) {
                      return quantity > 0 || hasComment || isRecharge;
                    } else {
                      const cost = parseFloat(item.cost || 0);
                      const time = parseFloat(item.timeEstimate || 0);
                      const hasDescription = item.description?.trim();
                      return (
                        hasDescription ||
                        hasComment ||
                        cost > 0 ||
                        time > 0
                      );
                    }
                  }

                  if (section === "contractor work") {
                    const cost = parseFloat(item.cost || 0);
                    const time = parseFloat(item.timeEstimate || 0);
                    const hasDescription = item.description?.trim();
                    return (
                      hasDescription ||
                      hasComment ||
                      cost > 0 ||
                      time > 0
                    );
                  }

                  return quantity > 0 || hasComment || isRecharge;
                });
                return [section, filtered];
              })
            ),
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error("Failed to send survey data to dashboard:", err);
      }

      // Also send to Firebase
      try {
        await addDoc(collection(db, "surveys"), {
          surveyorName,
          propertyAddress,
          address: propertyAddress,
          voidRating,
          voidType,
          mwrRequired,
          overallComments,
          totals,
          giftedItemsNotes,
          cookerClearance,
          cookerPointType,
          extractorFan,
          showerFitted,
          showerType,
          bathTurn,
          kitchenMWR,
          bathMWR,
          asbestosNotes,
          contractorNotes,
          lorryClearanceNotes,
          loftChecked,
          loftNeedsClearing,
          sors: Object.fromEntries(
            Object.entries(sors).map(([section, items]) => {
              const filtered = (items || []).filter((item) => {
                const quantity = parseFloat(item.quantity || 0);
                const hasComment = item.comment?.trim();
                const isRecharge = item.recharge === true;

                if (section === "lorry clearance") {
                  if (item.code) {
                    return quantity > 0 || hasComment || isRecharge;
                  } else {
                    const cost = parseFloat(item.cost || 0);
                    const time = parseFloat(item.timeEstimate || 0);
                    const hasDescription = item.description?.trim();
                    return (
                      hasDescription ||
                      hasComment ||
                      cost > 0 ||
                      time > 0
                    );
                  }
                }

                if (section === "contractor work") {
                  const cost = parseFloat(item.cost || 0);
                  const time = parseFloat(item.timeEstimate || 0);
                  const hasDescription = item.description?.trim();
                  return (
                    hasDescription ||
                    hasComment ||
                    cost > 0 ||
                    time > 0
                  );
                }

                return quantity > 0 || hasComment || isRecharge;
              });
              return [section, filtered];
            })
          ),
          submittedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to submit to Firebase:", err);
      }

      saveAs(content, `Empty_Homes_Survey_${safeAddr}.zip`);
    });
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
                  <Row className="align-items-center justify-content-between mb-3">
                    <Col>
                      {/* Removed duplicate "Empty Homes Survey" label */}
                    </Col>
                    <Col xs="auto">
                      <Form.Check
                        type="switch"
                        id="dark-mode-switch-front"
                        label="Dark Mode"
                        checked={darkMode}
                        onChange={(e) => setDarkMode(e.target.checked)}
                      />
                    </Col>
                  </Row>
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
                      className="w-100 mb-3"
                      onClick={() => setShowForm(true)}
                      disabled={!surveyorName || !propertyAddress}
                    >
                      Start New Survey
                    </Button>
                    {hasSavedSurvey && (
                      <>
                        <hr />
                        <Alert variant="info" className="text-center">A previously saved survey was found.</Alert>
                        <Button
                          variant="warning"
                          className="w-100 mb-2"
                          onClick={() => {
                            const parsed = JSON.parse(localStorage.getItem("surveyDraft"));
                            if (!parsed) return;
                            setSurveyorName(parsed.surveyorName || "");
                            setPropertyAddress(parsed.propertyAddress || "");
                            setVoidRating(parsed.voidRating || "Green");
                            setVoidType(parsed.voidType || "Minor");
                            setOverallComments(parsed.overallComments || "");
                            setMWRRequired(parsed.mwrRequired || false);
                            setSors(parsed.sors || {});
                            // Force accordion sections to refresh by toggling showForm off and back on
                            setShowForm(false);
                            setTimeout(() => setShowForm(true), 100);
                            setCookerClearance(parsed.cookerClearance || "");
                            setCookerPointType(parsed.cookerPointType || "");
                            setExtractorFan(parsed.extractorFan || "");
                            setShowerFitted(parsed.showerFitted || "");
                            setShowerType(parsed.showerType || "");
                            setBathTurn(parsed.bathTurn || "");
                            setKitchenMWR(parsed.kitchenMWR || "");
                            setBathMWR(parsed.bathMWR || "");
                            setBathTurnReminder(parsed.bathTurn === "Yes" ? "Bath turn required: Please arrange a refurb survey." : "");
                            setNeedsRefurbSurvey(parsed.bathTurn === "Yes");
                            setAsbestosNotes(parsed.asbestosNotes || "");
                            setContractorNotes(parsed.contractorNotes || "");
                            setLorryClearanceNotes(parsed.lorryClearanceNotes || "");
                            setLoftChecked(parsed.loftChecked || "");
                            setLoftNeedsClearing(parsed.loftNeedsClearing || "");
                            setGiftedItemsNotes(parsed.giftedItemsNotes || "");
                          }}
                        >
                          Continue Saved Survey
                        </Button>
                        <Button
                          variant="outline-danger"
                          className="w-100"
                          onClick={() => {
                            localStorage.removeItem("surveyDraft");
                            window.location.reload();
                          }}
                        >
                          Discard Saved Survey
                        </Button>
                      </>
                    )}
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
                <Col xs="auto">
                  <Form.Check
                    type="switch"
                    id="dark-mode-switch"
                    label="Dark Mode"
                    checked={darkMode}
                    onChange={(e) => setDarkMode(e.target.checked)}
                  />
                </Col>
              </Row>
              <Row className="g-3 mt-2 justify-content-center">
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
              {/* Import Previous Survey (.xlsx) Row - restored below summary card row */}
              <Row className="mt-3">
                <Col xs={12}>
                  <Form.Group controlId="importSurveyExcel">
                    <Form.Label className="fw-semibold">Import Previous Survey (.xlsx)</Form.Label>
                    <Form.Control
                      type="file"
                      accept=".xlsx"
                      onChange={handleImportExcel}
                    />
                  </Form.Group>
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
              <Row className="g-2 mt-1 justify-content-center">
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
              {/* Import Previous Survey (.xlsx) for mobile */}
              <Row className="mt-2">
                <Col xs={12}>
                  <Form.Group controlId="importSurveyExcelMobile">
                    <Form.Label className="text-muted small mb-1 fw-semibold">
                      Import Previous Survey (.xlsx)
                    </Form.Label>
                    <Form.Control
                      type="file"
                      accept=".xlsx"
                      onChange={handleImportExcel}
                      size="sm"
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Container>
          </div>

          {/* ─── Spacer for md+ sticky header ─── */}
          <div style={{ height: "30px" }}></div>

          {/* ─── Main Form Sections ─── */}
          <Container fluid className="px-4">
            <Accordion
              activeKey={activeSection}
              onSelect={(eventKey) => {
                setActiveSection(eventKey);
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    const item = accordionRefs.current[eventKey];
                    const header = item?.querySelector(".accordion-button");
                    const stickyHeaderHeight = document.querySelector(".sticky-top")?.offsetHeight || 90;
                    if (header) {
                      const y = header.getBoundingClientRect().top + window.pageYOffset - stickyHeaderHeight - 10;
                      window.scrollTo({ top: y, behavior: "smooth" });
                    }
                  }, 400); // Delay allows collapsing animation to finish
                });
              }}
              flush
            >
              {sectionKeys.map((section) => (
                <Accordion.Item
                  eventKey={section}
                  key={section}
                  className="mb-3"
                  ref={(el) => (accordionRefs.current[section] = el)}
                >
                  <Accordion.Header>{titleCase(section)}</Accordion.Header>
                  <Accordion.Body>
                    <SORSection
                      section={section}
                      sors={sors}
                      onAddSOR={handleAddSOR}
                      onUpdateSOR={handleUpdateSOR}
                      onRemoveSOR={handleRemoveSOR}
                      cookerClearance={cookerClearance}
                      cookerPointType={cookerPointType}
                      extractorFan={extractorFan}
                      showerFitted={showerFitted}
                      showerType={showerType}
                      bathTurn={bathTurn}
                      needsRefurbSurvey={needsRefurbSurvey}
                      bathTurnReminder={bathTurnReminder}
                      kitchenMWR={kitchenMWR}
                      bathMWR={bathMWR}
                      asbestosNotes={section === "asbestos" ? asbestosNotes : undefined}
                      setAsbestosNotes={section === "asbestos" ? setAsbestosNotes : undefined}
                      contractorNotes={section === "contractor work" ? contractorNotes : undefined}
                      setContractorNotes={section === "contractor work" ? setContractorNotes : undefined}
                      lorryClearanceNotes={section === "lorry clearance" ? lorryClearanceNotes : undefined}
                      setLorryClearanceNotes={section === "lorry clearance" ? setLorryClearanceNotes : undefined}
                      loftChecked={section === "loft" ? loftChecked : undefined}
                      setLoftChecked={section === "loft" ? setLoftChecked : undefined}
                      loftNeedsClearing={section === "loft" ? loftNeedsClearing : undefined}
                      setLoftNeedsClearing={section === "loft" ? setLoftNeedsClearing : undefined}
                    />
                  </Accordion.Body>
                </Accordion.Item>
              ))}

              {/* ─── Recharges Accordion ─── */}
              <Accordion.Item eventKey="recharges" className="mb-3">
                <Accordion.Header>Recharges</Accordion.Header>
                <Accordion.Body>
                  {/* Two cards side by side: Recharge Days & Recharge Cost */}
                  <Row className="g-3 mb-3 justify-content-center">
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

              {/* Gifted Items Accordion */}
              <Accordion.Item eventKey="gifted-items" className="mb-3">
                <Accordion.Header>Gifted Items</Accordion.Header>
                <Accordion.Body>
                  <Form.Group controlId="giftedItemsNotes">
                    <Form.Label className="fw-medium">Gifted Items Notes</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      placeholder="e.g. Carpets, curtains, furniture left behind…"
                      value={giftedItemsNotes}
                      onChange={(e) => setGiftedItemsNotes(e.target.value)}
                    />
                  </Form.Group>
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
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>
          </Container>

          {/* ─── Export Buttons (bottom) ─── */}
          <Container fluid className="px-4 mt-4 mb-5 text-center">
            <Button
              variant="primary"
              onClick={exportToZip}
            >
              Export Survey (Excel + PDF)
            </Button>
            <Button
              variant="secondary"
              className="ms-3"
              onClick={() => {
                const proceed = window.confirm("⚠️ Your data could be lost!");
                if (proceed) {
                  window.location.href =
                    "mailto:pete.irvine@bromford.co.uk?subject=Empty%20Homes%20Survey%20Feedback";
                }
              }}
            >
              Send Feedback
            </Button>
          </Container>
        </>
      )}
    </Container>
  );
}

export default App;