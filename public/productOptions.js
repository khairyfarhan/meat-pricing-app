const productOptions = {
    Chicken: ["Whole Chicken", "Chicken Breast", "Chicken Wings"],
    Mutton: ["Mutton Leg", "Mutton Shoulder", "Mutton Chops"],
    Lamb: ["Lamb Leg", "Lamb Rack", "Lamb Chops"],
    Beef: ["Beef Steak", "Beef Mince", "Beef Ribs"],
    Others: []
  };
  
  function updateProductOptions() {
    const category = document.getElementById("meatCategory").value;
    const productSelect = document.getElementById("product");
  
    // Clear current options
    productSelect.innerHTML = "";
  
    // Populate new options
    productOptions[category].forEach(product => {
      const option = document.createElement("option");
      option.value = product;
      option.textContent = product;
      productSelect.appendChild(option);
    });
  
    // If 'Others' is selected, allow user to type a custom product name
    if (category === "Others") {
      const option = document.createElement("option");
      option.value = "custom";
      option.textContent = "Enter custom product name";
      productSelect.appendChild(option);
      productSelect.outerHTML = `<input type="text" id="product" name="product" placeholder="Enter custom product" required>`;
    }
  }
  