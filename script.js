document.addEventListener('DOMContentLoaded', () => {
    const checkInBtn = document.getElementById('checkInBtn');
    const checkOutBtn = document.getElementById('checkOutBtn');
    const statusMessage = document.getElementById('statusMessage');
    const form = document.getElementById('attendanceForm');
    const locationSelect = document.getElementById('location');
    const shiftSelect = document.getElementById('shift');
    const fullNameInput = document.getElementById('fullName');
    const employeeIdInput = document.getElementById('employeeId');
    const phoneNumberInput = document.getElementById('phoneNumber');
    const reminderModal = document.getElementById('reminderModal');
    const closeModalBtn = document.querySelector('.close-btn');

    // ** استبدل هذا الرابط برابط Web app الذي نسخته من Google Apps Script **
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxFxVU9OjdJUYW9dij6CvmECqoeEL4MCwSE8MgHHkZnU-Zk1zv4VsrZI9lbRkLK9CqUQ/exec';

    // Store user data in localStorage
    const savedFullName = localStorage.getItem('fullName');
    const savedEmployeeId = localStorage.getItem('employeeId');
    const savedPhoneNumber = localStorage.getItem('phoneNumber');

    if (savedFullName) fullNameInput.value = savedFullName;
    if (savedEmployeeId) employeeIdInput.value = savedEmployeeId;
    if (savedPhoneNumber) phoneNumberInput.value = savedPhoneNumber;

    const locations = {
        "المركز 1": { lat: 21.381436227713426, lon: 39.8700974313206, radius: 5 },
        "المركز 4": { lat: 21.382217207576137, lon: 39.871421802484626, radius: 6 },
        "Home": { lat: 21.353332012296036, lon: 39.83317700978527, radius: 100 },
        "مكتب أ . محمد": { lat: 21.358667827435426, lon: 39.91056507116383, radius: 50 }, 
		     "home 2": { lat: 21.484813982107166, lon: 39.25697692973232, radius: 50 }
    };
    
    let lastCheckInTime = null;
    let lastCheckOutTime = null;

    // Haversine formula to calculate distance between two lat/lon points
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;
    
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
        return R * c; // in metres
    }

    // Function to check if the current time is within the selected shift
    function isWithinShift(shift, currentTime) {
        if (!shift) return false;
        const [startTimeStr, endTimeStr] = shift.split(' to ');
        const [startHour, startMinute] = startTimeStr.split(':').map(Number);
        const [endHour, endMinute] = endTimeStr.split(':').map(Number);
        
        let start = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), startHour, startMinute);
        let end = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), endHour, endMinute);

        if (end < start) {
            end.setDate(end.getDate() + 1);
        }

        return currentTime >= start && currentTime <= end;
    }

    // Check shift validity on change
    shiftSelect.addEventListener('change', () => {
        const selectedShift = shiftSelect.value;
        const currentTime = new Date();
        if (selectedShift && !isWithinShift(selectedShift, currentTime)) {
            statusMessage.textContent = 'اختر الوقت الصحيح لدوامك.';
            statusMessage.className = 'status-message error';
        } else if (selectedShift) {
            // Clear message if a valid shift is selected
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        }
    });

    // A function to send data to Google Sheet
    async function sendDataToGoogleSheet(data) {
        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log('Data sent successfully!', await response.text());
        } catch (error) {
            console.error('Error sending data:', error);
        }
    }

    // Handle check-in
    checkInBtn.addEventListener('click', () => {
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const selectedLocation = locationSelect.value;
        const selectedShift = shiftSelect.value;
        const currentLocation = locations[selectedLocation];
        const currentTime = new Date();

        // Check if the selected shift is valid for the current time
        if (!isWithinShift(selectedShift, currentTime)) {
            statusMessage.textContent = 'اختر الوقت الصحيح لدوامك.';
            statusMessage.className = 'status-message error';
            return;
        }

        if (lastCheckInTime && (currentTime - lastCheckInTime < 60000)) {
            statusMessage.textContent = 'تم تسجيل الحضور بالفعل في الدقيقة الحالية. لا يمكن التسجيل مرة أخرى.';
            statusMessage.className = 'status-message error';
            return;
        }

        if (!currentLocation) {
            statusMessage.textContent = 'الرجاء اختيار موقع صحيح.';
            statusMessage.className = 'status-message error';
            return;
        }

        // Get user's current location
        navigator.geolocation.getCurrentPosition(position => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            const distance = getDistance(userLat, userLon, currentLocation.lat, currentLocation.lon);

            if (distance <= currentLocation.radius) {
                const [shiftStartStr] = selectedShift.split(' to ');
                const [startHour, startMinute] = shiftStartStr.split(':').map(Number);
                const shiftStartDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), startHour, startMinute);

                let delayMinutes = Math.floor((currentTime - shiftStartDate) / (1000 * 60));
                
                if (delayMinutes > 0) {
                    statusMessage.textContent = `تم التحضير. أنت متأخر عن الوردية بـ ${delayMinutes} دقيقة.`;
                    statusMessage.className = 'status-message warning';
                } else {
                    statusMessage.textContent = 'تم التحضير بنجاح!';
                    statusMessage.className = 'status-message success';
                }

                // Success logic
                localStorage.setItem('fullName', fullNameInput.value);
                localStorage.setItem('employeeId', employeeIdInput.value);
                localStorage.setItem('phoneNumber', phoneNumberInput.value);
                
                lastCheckInTime = currentTime;
                
                checkInBtn.disabled = true;
                checkOutBtn.disabled = false;
                
                showReminderModal();
                
                // Send data to Google Sheet
                const data = {
                    Action: 'تسجيل حضور',
                    Location: selectedLocation,
                    Shift: selectedShift,
                    FullName: fullNameInput.value,
                    EmployeeID: employeeIdInput.value,
                    PhoneNumber: phoneNumberInput.value
                };
                sendDataToGoogleSheet(data);

            } else {
                statusMessage.textContent = `أنت خارج النطاق المحدد للموقع (المسافة: ${Math.round(distance)} متر). لا يمكن تسجيل الحضور.`;
                statusMessage.className = 'status-message error';
            }
        }, error => {
            statusMessage.textContent = 'تعذر الوصول إلى موقعك. تأكد من تفعيل خدمة تحديد المواقع.';
            statusMessage.className = 'status-message error';
            console.error(error);
        });
    });

    // Handle check-out
    checkOutBtn.addEventListener('click', () => {
        const currentTime = new Date();
        if (lastCheckOutTime && (currentTime - lastCheckOutTime < 60000)) {
            statusMessage.textContent = 'تم تسجيل الانصراف بالفعل في الدقيقة الحالية. لا يمكن التسجيل مرة أخرى.';
            statusMessage.className = 'status-message error';
            return;
        }
        
        lastCheckOutTime = currentTime;
        
        statusMessage.textContent = 'تم تسجيل الانصراف بنجاح. شكراً لك!';
        statusMessage.className = 'status-message success';
        checkOutBtn.disabled = true;
        checkInBtn.disabled = false;

        // Send check-out data to Google Sheet
        const data = {
            Action: 'تسجيل انصراف',
            Location: locationSelect.value,
            Shift: shiftSelect.value,
            FullName: fullNameInput.value,
            EmployeeID: employeeIdInput.value,
            PhoneNumber: phoneNumberInput.value
        };
        sendDataToGoogleSheet(data);
    });
    
    // Reminder Modal logic
    function showReminderModal() {
        reminderModal.style.display = 'block';
    }

    closeModalBtn.onclick = function() {
        reminderModal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == reminderModal) {
            reminderModal.style.display = 'none';
        }
    }
});
