(function(){
  // Extend dayjs with customParseFormat
  dayjs.extend(window.dayjs_plugin_customParseFormat);

  const url = new URL(location.href);
  const requestId = crypto.randomUUID();

  let datepickers = [];

  const airDatePickerConfig = {
    dateFormat: 'dd-MM-yyyy',
    autoClose: true,
    locale: {
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      daysMin: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      today: "Today",
      clear: "Clear",
      firstDay: 0
    },
  }

  const travelDateEl = new AirDatepicker('#travel-date', {
    range: true,
    minDate: new Date(),
    multipleDatesSeparator: ' - ',
    ...airDatePickerConfig,
  });

  const decodeFromBase64Url = (base64Url) => {
    // Restore padding
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }

    let jsonString = "";
    if (typeof window !== "undefined" && window.atob) {
      // Browser
      jsonString = atob(base64);
    }

    return JSON.parse(jsonString);
  }

  const generateBookingCode = (length = 8) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars[randomIndex];
    }
    return result;
  }

  const generateDatePicker = () => {
    // Clear old datepickers
    datepickers.forEach(dp => dp.destroy());
    datepickers = [];

    // Attach AirDatepicker to ALL dob fields
    document.querySelectorAll('[name="dob"]').forEach(input => {
      const dp = new AirDatepicker(input, {
        maxDate: new Date(),
        ...airDatePickerConfig,
      });
      datepickers.push(dp);
    });
  };

  const validateForm = (data) => {
    // Reusable regex for YYYY-MM-DD format
    const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

    // Passenger schema
    const passenger = joi.object({
      name: joi.string().required(),
      dob: joi.string().pattern(dateFormat).required()
        .messages({
          "string.pattern.base": `"dob" must be in YYYY-MM-DD format`
        }),
    });

    // Main schema
    const schema = joi.object({
      request_id: joi.string().required(),
      code: joi.string().required(),
      start_date: joi.string().pattern(dateFormat).required()
        .messages({
          "string.pattern.base": `"start_date" must be in YYYY-MM-DD format`
        }),
      end_date: joi.string().pattern(dateFormat).required()
        .messages({
          "string.pattern.base": `"end_date" must be in YYYY-MM-DD format`
        }),
      budget: joi.string().required(),
      email: joi.string().email({ tlds: { allow: false } }).required(),
      passangers: joi.array().items(passenger).min(1),
      special_requirement: joi.string().allow('', null)
    });

    return schema.validate(data, { abortEarly: false }); // show all errors
  };

  const fillForm = (base64url) => {
    const data = decodeFromBase64Url(base64url);
    console.log(data);

    if (data.code) {
      document.getElementById('code').value = data.code;
    }

    if (data.Email) {
      document.getElementById('email').value = data.Email;
    }

    if (data.Phone) {
      document.getElementById('phone').value = data.Phone;
    }

    if (data.budget) {
      document.getElementById('budget').value = data.budget;
    }

    if (data['Arrival Date'] && data['Departure Date']) {
      const arrivalDate = dayjs(data['Arrival Date']);
      const departureDate = dayjs(data['Departure Date']);

      if (arrivalDate.isValid() && departureDate.isValid()) {
        travelDateEl.selectDate([
          arrivalDate.toDate(),
          departureDate.toDate()
        ]);
      }
    }
  }

  document.querySelector('button[name="btn-add-passanger"]').addEventListener('click', function(e){
    e.preventDefault();

    const passengerEl = document.querySelector('.passanger').cloneNode(true);
    passengerEl.querySelector('[name="name"]').value = '';
    passengerEl.querySelector('[name="dob"]').value = '';

    document.getElementById('passangers').appendChild(passengerEl);

    // reinit all datepickers
    generateDatePicker();
  });

  document.querySelector('button[name="submit"]').addEventListener('click', function(e){
    e.preventDefault();
    const [startDate, endDate] = document.getElementById('travel-date').value.split(' - ');

    const passangers = [];
    document.querySelectorAll('.passanger').forEach(passangerEl => {
      const dob = dayjs(passangerEl.querySelector('[name="dob"]').value, 'DD-MM-YYYY')
        .format('YYYY-MM-DD');

      passangers.push({
        name: passangerEl.querySelector('[name="name"]').value,
        dob,
      })
    });

    const data = {
      request_id: requestId,
      code: document.getElementById('code').value || generateBookingCode(6),
      start_date: dayjs(startDate.trim(), "DD-MM-YYYY").format('YYYY-MM-DD'),
      end_date: dayjs(endDate.trim(), "DD-MM-YYYY").format('YYYY-MM-DD'),
      budget: document.getElementById('budget').value,
      email: document.getElementById('email').value,
      passangers,
      special_requirement: document.getElementById('special-requirement').value,
    }

    const errors = validateForm(data);
    if (errors?.error?.details) {
      const errorMessage = errors
        .error
        .details
        .map(error => error.message)
        .join('\n');

      alert(errorMessage);
      return;
    }

    document.querySelector('button[name="submit"]').textContent = 'Please wait...'
    document.querySelector('button[name="submit"]').setAttribute('disabled', 'disabled');
    fetch('https://meidi.n8n.superlazy.ai/webhook-test/book', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
    })
      .then(response => response.json())
      .then(response => {
      document.querySelector('button[name="submit"]').textContent = 'Submitted'
        console.log(response);
      });
  });

  // initialize on page load
  generateDatePicker();

  const q = url.searchParams.get('q')
  if (q) {
    fillForm(q);
  }
})();