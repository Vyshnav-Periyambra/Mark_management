document.addEventListener("DOMContentLoaded", function () {
  // --- Constants and DOM Element References ---
  const form = document.getElementById("markForm");
  const marksTable = document.getElementById("marksTable");
  const tableBody = marksTable.getElementsByTagName("tbody")[0];
  const tableFoot = marksTable.getElementsByTagName("tfoot")[0];
  const moveDestinationSelect = document.getElementById("moveDestination");
  const moveSelectedBtn = document.getElementById("moveSelectedBtn");
  const addUpdateBtn = document.getElementById("addUpdateBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  const passTableBody = document
    .getElementById("passTable")
    .getElementsByTagName("tbody")[0];
  const failTableBody = document
    .getElementById("failTable")
    .getElementsByTagName("tbody")[0];

  const showSummaryBtn = document.getElementById("showSummaryBtn");
  const studentSummarySection = document.getElementById(
    "studentSummarySection",
  );
  const summaryTableBody = document
    .getElementById("summaryTable")
    .getElementsByTagName("tbody")[0];

  const marksInput = document.getElementById("marks");
  const outOfInput = document.getElementById("outOf");
  const formResultLabel = document.getElementById("formResultLabel");

  const messageBoxOverlay = document.getElementById("messageBoxOverlay");
  const messageBoxTitle = document.getElementById("messageBoxTitle");
  const messageBoxContent = document.getElementById("messageBoxContent");
  const messageBoxCloseBtn = document.getElementById("messageBoxCloseBtn");

  // --- State Variables ---
  let allEntries = []; // Represents entries in the main "pending" table
  let passEntries = []; // Represents entries in the "pass" table
  let failEntries = []; // Represents entries in the "fail" table
  let isEditing = false; // Tracks if an edit is in progress

  // --- Utility Functions ---

  /**
   * Retrieves the CSRF token from cookies for Django POST/PUT/DELETE requests.
   * @param {string} name - The name of the cookie to retrieve.
   * @returns {string|null} The cookie value or null if not found.
   */
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === name + "=") {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }
  const csrftoken = getCookie("csrftoken");

  /**
   * Displays a custom message box.
   * @param {string} title - The title of the message box.
   * @param {string} message - The content message.
   */
  function showMessageBox(title, message) {
    messageBoxTitle.innerText = title;
    messageBoxContent.innerText = message;
    messageBoxOverlay.classList.add("show");
  }

  /**
   * Hides the custom message box.
   */
  function hideMessageBox() {
    messageBoxOverlay.classList.remove("show");
  }

  /**
   * Enables or disables all edit and delete buttons in the main table.
   * Used to prevent multiple simultaneous edits.
   * @param {boolean} disable - True to disable buttons, false to enable.
   */
  function disableEditButtons(disable) {
    const editButtons = document.querySelectorAll(".edit-btn");
    const deleteButtons = document.querySelectorAll(".delete-btn");
    editButtons.forEach((button) => {
      button.disabled = disable;
    });
    deleteButtons.forEach((button) => {
      button.disabled = disable;
    });
  }

  /**
   * Updates the text content of the "Add/Update Entry" button
   * and controls the visibility of the "Cancel Edit" button based on `isEditing` state.
   */
  function updateSubmitButtonText() {
    if (addUpdateBtn) {
      addUpdateBtn.textContent = isEditing ? "Update Entry" : "Add Entry";
      if (cancelEditBtn) {
        cancelEditBtn.style.display = isEditing ? "inline-block" : "none";
      }
    }
  }

  /**
   * Updates the result label (Pass/Fail) next to the marks input field
   * based on the current marks and outOf values.
   */
  function updateFormResultLabel() {
    const marks = parseFloat(marksInput ? marksInput.value : NaN);
    const outOf = parseFloat(outOfInput ? outOfInput.value : NaN);

    if (!isNaN(marks) && !isNaN(outOf) && outOf > 0) {
      const percentage = (marks / outOf) * 100;
      const result = percentage >= 40 ? "Pass" : "Fail";
      if (formResultLabel) {
        formResultLabel.innerText = "(" + result + ")";
        formResultLabel.className = `result-label ${result === "Pass" ? "pass-text" : "fail-text"}`;
      }
    } else {
      if (formResultLabel) {
        formResultLabel.innerText = "";
        formResultLabel.className = "result-label";
      }
    }
  }

  // --- Data Fetching and Management ---

  /**
   * Fetches marks data from the API, updates global state arrays,
   * and re-renders all tables.
   */
  async function fetchMarks() {
    try {
      const response = await fetch("/api/marks/");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // Assuming `data` contains all entries,
      // and `r_status` is the property indicating "pass" or "fail" for categorization.
      // The `allEntries` array is explicitly for "pending" or main table entries now,
      // and `r_status` is used to filter for `passEntries` and `failEntries`.
      // If your API returns a `result_status` directly, adjust `r_status` accordingly.
      console.log("Fetched marks data:", data);
      allEntries = data.filter((entry) => entry.r_status === "pending"); // Filter for pending/main entries

      console.log("Fetched all entries:", allEntries);
      passEntries = data.filter((entry) => entry.r_status === "pass");
      failEntries = data.filter((entry) => entry.r_status === "fail");

      renderTable(); // Renders `allEntries` (your "pending" table)
      renderPassTable();
      renderFailTable();
      updateTotalRow();
      updateMoveButtonState(); // Ensure button state is correct on load
    } catch (error) {
      console.error("Error fetching marks:", error);
      showMessageBox("Error", "Could not load marks from the server.");
    }
  }

  /**
   * Handles the deletion of a mark entry.
   * @param {number} id - The ID of the entry to delete.
   */
  async function deleteRow(id) {
    try {
      const response = await fetch("/api/marks/", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken,
        },
        body: JSON.stringify({ id: id }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessageBox("Error", result.error || "Failed to delete entry.");
        return;
      }
      await fetchMarks(); // Re-fetch data after deletion
      studentSummarySection.classList.remove("show"); // Hide summary if open
      showMessageBox("Success", "Entry deleted successfully!");
    } catch (error) {
      console.error("Error deleting mark:", error);
      showMessageBox("Error", "Failed to delete entry. Please try again.");
    }
  }

  /**
   * Populates the form with data from a selected entry for editing.
   * @param {number} id - The ID of the entry to edit.
   */
  function editRow(id) {
    if (isEditing) {
      showMessageBox(
        "Editing In Progress",
        "Please complete or cancel the current edit before starting a new one.",
      );
      return;
    }

    // Find the entry in any of the lists
    const entryToEdit =
      allEntries.find((entry) => entry.id === id) ||
      passEntries.find((entry) => entry.id === id) ||
      failEntries.find((entry) => entry.id === id);

    if (entryToEdit) {
      isEditing = true; // Lock editing
      disableEditButtons(true); // Disable all other edit/delete buttons
      updateSubmitButtonText(); // Change button text to "Update Entry"

      // Populate form
      document.getElementById("name").value = entryToEdit.name;
      document.getElementById("dob").value = entryToEdit.dob;
      document.getElementById("date").value = entryToEdit.date;
      document.getElementById("subject").value = entryToEdit.subject;
      document.getElementById("marks").value = entryToEdit.marks;
      document.getElementById("outOf").value = entryToEdit.outOf;
      updateFormResultLabel();

      // Set a temporary ID for the form to indicate an edit operation
      form.setAttribute("data-editing-id", entryToEdit.id);

      // Hide the student summary section if applicable
      studentSummarySection.classList.remove("show");
    }
  }

  /**
   * Sorts the main marks table based on the specified column index.
   * @param {number} colIndex - The index of the column to sort by.
   */
  function sortTable(colIndex) {
    const isNumberCol = [5, 6, 7].includes(colIndex); // Marks, Out of, Percentage
    const isDateCol = [2, 3].includes(colIndex); // DOB, Date

    let sortOrder = marksTable.getAttribute("data-sort-order");
    let currentSortCol = marksTable.getAttribute("data-sort-col");

    if (parseInt(currentSortCol) === colIndex && sortOrder === "asc") {
      sortOrder = "desc";
    } else {
      sortOrder = "asc";
    }

    marksTable.setAttribute("data-sort-col", colIndex);
    marksTable.setAttribute("data-sort-order", sortOrder);

    allEntries.sort((a, b) => {
      let aVal, bVal;
      switch (colIndex) {
        case 1: // Name
          aVal = a.name;
          bVal = b.name;
          break;
        case 2: // DOB (assuming a.dob, b.dob are available, though not rendered in `renderTable` directly)
          aVal = a.dob;
          bVal = b.dob;
          break;
        case 3: // Date
          aVal = a.date;
          bVal = b.date;
          break;
        case 4: // Subject
          aVal = a.subject;
          bVal = b.subject;
          break;
        case 5: // Marks
          aVal = a.marks;
          bVal = b.marks;
          break;
        case 6: // Out of
          aVal = a.outOf;
          bVal = b.outOf;
          break;
        case 7: // Percentage
          aVal = a.percentage;
          bVal = b.percentage;
          break;
        case 8: // Result
          aVal = a.result;
          bVal = b.result;
          break;
        default:
          return 0;
      }

      let comparison = 0;
      if (isNumberCol) {
        comparison = parseFloat(aVal) - parseFloat(bVal);
      } else if (isDateCol) {
        comparison = new Date(aVal) - new Date(bVal);
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
    renderTable();
    studentSummarySection.classList.remove("show");
  }

  /**
   * Updates the state of the "Move Selected" button based on
   * checked checkboxes and the selected destination.
   */
  function updateMoveButtonState() {
    const checkedCheckboxes = tableBody.querySelectorAll(
      'input[type="checkbox"]:checked',
    );
    const isAnyChecked = checkedCheckboxes.length > 0;
    const destination = moveDestinationSelect ? moveDestinationSelect.value : "";

    if (!isAnyChecked || (destination !== "pass" && destination !== "fail")) {
      moveSelectedBtn.disabled = true;
      return;
    }

    const selectedIds = Array.from(checkedCheckboxes).map((cb) =>
      parseInt(cb.getAttribute("data-id")),
    );
    const selectedEntries = allEntries.filter((entry) =>
      selectedIds.includes(entry.id),
    );

    let compatible = true;
    for (const entry of selectedEntries) {
      const result = entry.result.toLowerCase();
      // Logic for moving 'Pass' to 'Fail' or 'Fail' to 'Pass'
      // Your API logic would handle this more robustly, but this is a client-side check.
      if (
        (destination === "pass" && result === "fail") ||
        (destination === "fail" && result === "pass")
      ) {
        compatible = false;
        break;
      }
    }
    moveSelectedBtn.disabled = !compatible;
  }

  // --- Table Rendering Functions ---

  /**
   * Renders the main marks table (`allEntries`).
   */
  function renderTable() {
    tableBody.innerHTML = "";
    allEntries.forEach((entry) => {
      const newRow = tableBody.insertRow();
      newRow.setAttribute("data-id", entry.id);

      const checkboxCell = newRow.insertCell(0);
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "row-checkbox";
      checkbox.setAttribute("data-id", entry.id);
      checkbox.addEventListener("change", updateMoveButtonState);
      checkboxCell.appendChild(checkbox);

      newRow.insertCell(1).innerText = entry.name;
      newRow.insertCell(2).innerText = entry.date;
      newRow.insertCell(3).innerText = entry.subject;
      newRow.insertCell(4).innerText = entry.marks;
      newRow.insertCell(5).innerText = entry.outOf;
      newRow.insertCell(6).innerText = entry.percentage.toFixed(2) + "%";
      const resultCell = newRow.insertCell(7);
      resultCell.textContent = entry.result;
      resultCell.className =
        entry.result === "Pass" ? "pass-text" : "fail-text";

      const actionsCell = newRow.insertCell(8);
      const editButton = document.createElement("button");
      editButton.className = "edit-btn";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => editRow(entry.id));
      actionsCell.appendChild(editButton);

      const actionsCell2 = newRow.insertCell(9);
      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-btn";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteRow(entry.id));
      actionsCell2.appendChild(deleteButton);
    });
    updateTotalRow();
  }

  /**
   * Updates the total row in the main marks table footer.
   */
  function updateTotalRow() {
    let totalMarks = 0;
    let totalOutOf = 0;

    allEntries.forEach((entry) => {
      totalMarks += entry.marks;
      totalOutOf += entry.outOf;
    });

    const overallPercentage = totalOutOf > 0 ? (totalMarks / totalOutOf) * 100 : 0;

    let totalRow = tableFoot.querySelector("#totalRow");
    if (!totalRow) {
      totalRow = tableFoot.insertRow();
      totalRow.id = "totalRow";
      // Create cells for the total row based on table headers
      totalRow.insertCell(0).innerText = ""; // Checkbox column
      totalRow.insertCell(1).innerText = ""; // Name
      totalRow.insertCell(2).innerText = "Total:"; // Date - label
      totalRow.insertCell(3); // Subject - empty
      totalRow.insertCell(4); // Marks - total marks
      totalRow.insertCell(5); // Out of - total out of
      totalRow.insertCell(6); // Percentage - overall percentage
      totalRow.insertCell(7).innerText = ""; // Result - empty
      totalRow.insertCell(8).innerText = ""; // Actions (Edit/Delete) - empty
    }

    // Update the content of the cells
    totalRow.cells[4].innerText = totalMarks.toFixed(2); // Marks total
    totalRow.cells[5].innerText = totalOutOf.toFixed(2); // Out of total
    totalRow.cells[6].innerText = overallPercentage.toFixed(2) + "%"; // Overall percentage
  }

 
function renderPassTable() {
    if (!passTableBody) return;
    passTableBody.innerHTML = "";
    passEntries.forEach((entry) => {
        const newRow = passTableBody.insertRow();
        newRow.insertCell(0).innerText = entry.name;
        newRow.insertCell(1).innerText = entry.date;
        newRow.insertCell(2).innerText = entry.subject;
        newRow.insertCell(3).innerText = entry.marks;
        const resultCell = newRow.insertCell(4);
        resultCell.innerText = entry.result;
        resultCell.className =
            entry.result.toLowerCase() === "pass" ? "pass-text" : "fail-text";
        newRow.insertCell(5).innerText = entry.outOf;
        newRow.insertCell(6).innerText = entry.percentage.toFixed(2) + "%";

        // Create the reset button cell (7th cell, index 7)
        const resetCell = newRow.insertCell(7);
        const resetButton = document.createElement("button");
        resetButton.innerText = "Reset";
        resetButton.className = "reset-btn"; // Add a class for styling
        resetButton.addEventListener("click", () => handleResetStatus(entry, csrftoken));
        resetCell.appendChild(resetButton);
    });
}

  function renderFailTable() {
    if (!failTableBody) return;
    failTableBody.innerHTML = "";
    failEntries.forEach((entry) => {
      const newRow = failTableBody.insertRow();
      newRow.insertCell(0).innerText = entry.name;
      newRow.insertCell(1).innerText = entry.date;
      newRow.insertCell(2).innerText = entry.subject;
      newRow.insertCell(3).innerText = entry.marks;
      const resultCell = newRow.insertCell(4);
      resultCell.innerText = entry.result;
      resultCell.className =
        entry.result === "Pass" ? "pass-text" : "fail-text";
      newRow.insertCell(5).innerText = entry.outOf;
      newRow.insertCell(6).innerText = entry.percentage.toFixed(2) + "%";
     const resetCell = newRow.insertCell(7);
        const resetButton = document.createElement("button");
        resetButton.innerText = "Reset";
        resetButton.className = "reset-btn";
        resetButton.addEventListener("click", () => handleResetStatus(entry, csrftoken));
        resetCell.appendChild(resetButton);
    });
}

async function handleResetStatus(entry, csrftoken) {
    const confirmReset = confirm(
        `Are you sure you want to reset the status for ${entry.name} - ${entry.subject} to Pending?`
    );
    if (!confirmReset) {
        return;
    }

    try {
        const response = await fetch("/api/reset-status/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken,
            },
            body: JSON.stringify({ id: entry.id }),
        });

        const result = await response.json();

        if (!response.ok) {
            showMessageBox("Error", result.error || "Failed to reset status.");
            return;
        }

        showMessageBox("Success", `Successfully reset status for ${entry.name} - ${entry.subject} to Pending.`);
        await fetchMarks();
        studentSummarySection.classList.remove("show");
    } catch (error) {
        console.error("Error resetting individual status:", error);
        showMessageBox("Error", "An error occurred while trying to reset this entry.");
    }
}


  function updateSummaryTable() {
    summaryTableBody.innerHTML = "";

    const studentGrandTotals = new Map();

    // Combine all entries from all lists to calculate grand totals for summary
    const combinedEntries = [...allEntries, ...passEntries, ...failEntries];

    combinedEntries.forEach((entry) => {
      if (!studentGrandTotals.has(entry.name)) {
        studentGrandTotals.set(entry.name, {
          name: entry.name,
          totalMarks: 0,
          totalOutOf: 0,
        });
      }

      const current = studentGrandTotals.get(entry.name);
      current.totalMarks += entry.marks;
      current.totalOutOf += entry.outOf;
    });

    studentGrandTotals.forEach((totals, name) => {
      const grandPercentage =
        totals.totalOutOf > 0
          ? (totals.totalMarks / totals.totalOutOf) * 100
          : 0;

      const summaryRow = summaryTableBody.insertRow();
      summaryRow.insertCell(0).innerText = totals.name;
      summaryRow.insertCell(1).innerText = totals.totalMarks.toFixed(2);
      summaryRow.insertCell(2).innerText = totals.totalOutOf.toFixed(2);
      summaryRow.insertCell(3).innerText = grandPercentage.toFixed(2) + "%";

      const viewCell = summaryRow.insertCell(4);
      const viewBtn = document.createElement("button");
      viewBtn.className = "submit-btn";
      viewBtn.innerText = "View Scorecard";
      viewBtn.onclick = () => {
        window.open(`/scorecard/${name}/`, "_blank");
      };
      viewCell.appendChild(viewBtn);

      const downloadCell = summaryRow.insertCell(5);
      const downloadBtn = document.createElement("button");
      downloadBtn.className = "delete-btn"; // Assuming this is your styling class
      downloadBtn.innerText = "Download PDF";
      downloadBtn.onclick = () => {
      window.open(`/scorecard/${name}/?pdf=true`, '_blank'); // Opens in new tab
    };
      downloadCell.appendChild(downloadBtn);

    });
  }

  // --- Event Listeners ---

  // Form submission handler (Add/Update)
  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const dob = document.getElementById("dob").value;
    const date = document.getElementById("date").value;
    const subject = document.getElementById("subject").value.trim();
    const marks = document.getElementById("marks").value;
    const outOf = document.getElementById("outOf").value;

    const marksNum = parseFloat(marks);
    const outOfNum = parseFloat(outOf);

    // Client-side validation
    if (!name ||!dob ||!date ||!subject ||isNaN(marksNum) ||isNaN(outOfNum)) {
      showMessageBox("Form Error", "One or more form fields are missing.");
      return;
    }
    if (marksNum > outOfNum) {
      showMessageBox(
        "Input Error",
        'Marks obtained cannot be greater than "Out Of" marks.',
      );
      return;
    }

    // DOB - at least 15 years old (client-side check)
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 15) {
      showMessageBox("Input Error", "Student must be at least 15 years old.");
      return;
    }

    const editingId = form.getAttribute("data-editing-id");
    let method = "POST";
    let apiUrl = "/api/marks/";
    let successMessage = "Entry added successfully!";

    const entryData = {
      name,
      dob,
      date,
      subject,
      marks: marksNum,
      outOf: outOfNum,
    };
    console.log(entryData)

    if (editingId) {
      method = "PUT";
      apiUrl = "/api/marks/"; // Assuming PUT to the base endpoint handles update based on ID in body
      entryData.id = parseInt(editingId); // Add the ID for update
      successMessage = "Entry updated successfully!";
    }

    try {
      const response = await fetch(apiUrl, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken,
        },
        body: JSON.stringify(entryData),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessageBox(
          "Error",
          result.error || "An unexpected error occurred.",
        );
        return;
      }

      isEditing = false;
      disableEditButtons(false);
      form.removeAttribute("data-editing-id");
      await fetchMarks(); // Re-fetch data to update all tables
      form.reset(); // This will also trigger the 'reset' event listener
      studentSummarySection.classList.remove("show");
      updateFormResultLabel(); // Update after reset
      updateSubmitButtonText(); // Reset button text
      showMessageBox("Success", successMessage);
    } catch (error) {
      console.error(`Error ${editingId ? "updating" : "adding"} mark:`, error);
      showMessageBox(
        "Error",
        `Failed to ${editingId ? "update" : "add"} entry. Please try again.`,
      );
    }
  });

  // Handle form reset (including programmatic reset from submit success)
  form.addEventListener("reset", function () {
    isEditing = false;
    disableEditButtons(false);
    form.removeAttribute("data-editing-id");
    updateSubmitButtonText();
    updateFormResultLabel(); // Clear form result label
  });

  // Event listeners for marks and outOf fields to update result label dynamically
  if (marksInput) marksInput.addEventListener("input", updateFormResultLabel);
  if (outOfInput) outOfInput.addEventListener("input", updateFormResultLabel);

  // Cancel Edit button
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", function () {
      form.reset(); // Resets form, which also triggers the 'reset' event listener
    });
  }

  // Event listener for sorting table headers
  document.querySelectorAll("#marksTable th button").forEach((button) => {
    const colIndex = parseInt(button.getAttribute("data-col-index"));
    // Mapping HTML column index to internal data index
    const htmlColIndexToDataIndex = {
      0: 1, // Name (HTML index 0, Data index 1)
      1: 3, // Date (HTML index 1, Data index 3)
      2: 4, // Subject (HTML index 2, Data index 4)
      3: 5, // Marks (HTML index 3, Data index 5)
      4: 6, // Out of (HTML index 4, Data index 6)
      5: 7, // Percentage (HTML index 5, Data index 7)
      6: 8, // Result (HTML index 6, Data index 8)
    };
    const mappedColIndex = htmlColIndexToDataIndex[colIndex];
    if (!isNaN(mappedColIndex)) {
      button.addEventListener("click", () => sortTable(mappedColIndex));
    }
  });

  // Move Selected button handler
  moveSelectedBtn.addEventListener("click", async function () {
    const checkedIds = Array.from(
      tableBody.querySelectorAll(".row-checkbox:checked"),
    ).map((checkbox) => parseInt(checkbox.getAttribute("data-id")));

    if (checkedIds.length === 0) {
      showMessageBox("No Selection", "Please select at least one entry to move.");
      return;
    }

    const destination = moveDestinationSelect ? moveDestinationSelect.value : "";

    if (destination !== "pass" && destination !== "fail") {
      showMessageBox("Selection Error", 'Please select either "Pass" or "Fail".');
      return;
    }

    // Client-side compatibility check before sending to server
    let compatible = true;
    for (const id of checkedIds) {
      const entry = allEntries.find((e) => e.id === id); // Check in current `allEntries`
      if (entry) {
        const result = entry.result.toLowerCase();
        if (
          (destination === "pass" && result === "fail") ||
          (destination === "fail" && result === "pass")
        ) {
          compatible = false;
          break;
        }
      }
    }

    if (!compatible) {
      showMessageBox(
        "Move Error",
        "Cannot move 'Fail' entries to 'Pass' table or vice versa.",
      );
      return;
    }

    try {
      const response = await fetch("/api/update/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken,
        },
        body: JSON.stringify({
          ids: checkedIds,
          newStatus: destination,
        }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      // Re-fetch data from the server to ensure consistency
      await fetchMarks();
      showMessageBox("Success", "Selected entries moved and updated.");
      if (studentSummarySection) studentSummarySection.classList.remove("show");
    } catch (err) {
      console.error("Error moving entries:", err);
      showMessageBox("Error", "Failed to update.");
    }
  });

  // Event listeners for updating move button state
  if (moveDestinationSelect) {
    moveDestinationSelect.addEventListener("change", updateMoveButtonState);
  }
  if (tableBody) {
    // Event delegation for checkboxes
    tableBody.addEventListener("change", function (event) {
      if (event.target.classList.contains("row-checkbox")) {
        updateMoveButtonState();
      }
    });
  }

  // Message box close button and overlay click
  messageBoxCloseBtn.addEventListener("click", hideMessageBox);
  messageBoxOverlay.addEventListener("click", function (event) {
    if (event.target === messageBoxOverlay) {
      hideMessageBox();
    }
  });

  // Show Summary Button
  showSummaryBtn.addEventListener("click", function () {
    updateSummaryTable();
    studentSummarySection.classList.toggle("show");
  });

  // --- Initializations on Page Load ---

  fetchMarks(); // Initial fetch of marks when the page loads
  updateFormResultLabel(); // Initialize form result label
  updateSubmitButtonText(); // Initialize submit button text
});

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const scrollToId = params.get('scrollTo');
  
  if (scrollToId) {
    const element = document.getElementById(scrollToId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
});

