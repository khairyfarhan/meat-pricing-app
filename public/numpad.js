function addDigit(digit) {
    const pinInput = document.getElementById('pinInput');
    if (pinInput.value.length < 4) {
      pinInput.value += digit;
    }
  }
  
  function clearPin() {
    document.getElementById('pinInput').value = '';
  }
  
  function submitPin() {
    const pinInput = document.getElementById('pinInput').value;
    if (pinInput === '1234') {  // Replace '1234' with your desired PIN
      window.location.href = '/';
    } else {
      alert('Incorrect PIN');
      clearPin();
    }
  }
  