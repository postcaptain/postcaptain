(function (window, document, $) {
  'use strict';

  function generateTimeOptions(selectElement, selectedValue, includeOther) {
    var startHour = 8;
    var endHour = 16;
    var stepMinutes = 15;
    var hour;
    var minute;

    selectElement.innerHTML = '<option value="">Select time</option>';

    for (hour = startHour; hour <= endHour; hour += 1) {
      for (minute = 0; minute < 60; minute += stepMinutes) {
        var h = String(hour).padStart(2, '0');
        var m = String(minute).padStart(2, '0');
        var time = h + ':' + m;

        var label = new Date(0, 0, 0, hour, minute).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });

        var option = document.createElement('option');
        option.value = time;
        option.textContent = label;

        if (selectedValue === time) {
          option.selected = true;
        }

        selectElement.appendChild(option);
      }
    }

    if (includeOther) {
      var otherOption = document.createElement('option');
      otherOption.value = 'other';
      otherOption.textContent = 'Other...';

      if (
        selectedValue &&
        !Array.prototype.some.call(selectElement.options, function (opt) {
          return opt.value === selectedValue;
        })
      ) {
        otherOption.selected = true;
      }

      selectElement.appendChild(otherOption);
    }
  }

  function syncManualTimeInput(selectEl, inputEl) {
    var selected = selectEl.value;

    if (selected === 'other') {
      inputEl.style.display = 'inline';
      inputEl.required = true;
    } else {
      inputEl.style.display = 'none';
      inputEl.required = false;
      inputEl.value = selected;
    }
  }

  function formatTime(inputTime) {
    var timeParts = inputTime.split(':');
    var date = new Date();

    date.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0);

    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatDateAndTime(dateInput, timeInput) {
    var dateParts = dateInput.split('/');
    var month = parseInt(dateParts[0], 10);
    var day = parseInt(dateParts[1], 10);
    var year = parseInt(dateParts[2], 10);

    var date = new Date(year, month - 1, day);

    var formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    return formattedDate + ' at ' + timeInput.replace(/ /g, '');
  }

  function extractEventId(response) {
    var idRegex = /id=([a-f0-9\-]+)/i;
    var matches = response && response.match(idRegex);

    return matches && matches[1] ? matches[1] : null;
  }

  function buildRequestUrl(config) {
    if (config.mode === 'edit') {
      return 'https://go.postcaptain.com/manage/event/edit?id=' + config.eventId;
    }

    return 'https://go.postcaptain.com/manage/event/edit?parent=' + config.parentId;
  }

  function bindPopup(config) {
    var form = document.getElementById('event-form');
    var submitButton = document.getElementById('event-form-submit');
    var typeInput = document.getElementById('type');
    var statusInput = document.getElementById('status');
    var startSelect = document.getElementById('start-time-select');
    var endSelect = document.getElementById('end-time-select');
    var startInput = document.getElementById('start-time');
    var endInput = document.getElementById('end-time');

    if (!form || !submitButton || !typeInput || !statusInput || !startSelect || !endSelect || !startInput || !endInput) {
      return;
    }

    generateTimeOptions(startSelect, config.preselectedStartTime, true);
    generateTimeOptions(endSelect, config.preselectedEndTime, true);

    if (
      config.preselectedStartTime &&
      !Array.prototype.some.call(startSelect.options, function (opt) {
        return opt.value === config.preselectedStartTime;
      })
    ) {
      startSelect.value = 'other';
      startInput.style.display = 'inline';
      startInput.required = true;
      startInput.value = config.preselectedStartTime;
    }

    if (
      config.preselectedEndTime &&
      !Array.prototype.some.call(endSelect.options, function (opt) {
        return opt.value === config.preselectedEndTime;
      })
    ) {
      endSelect.value = 'other';
      endInput.style.display = 'inline';
      endInput.required = true;
      endInput.value = config.preselectedEndTime;
    }

    startSelect.addEventListener('change', function () {
      var selectedStart = startSelect.value;
      var type = typeInput.value;
      var duration = (config.durationMap && config.durationMap[type]) || 60;

      syncManualTimeInput(startSelect, startInput);

      if (!selectedStart || selectedStart === 'other') {
        return;
      }

      var parts = selectedStart.split(':');
      var end = new Date();
      end.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      end.setMinutes(end.getMinutes() + duration);

      var autoEnd =
        String(end.getHours()).padStart(2, '0') +
        ':' +
        String(end.getMinutes()).padStart(2, '0');

      if (endSelect.value !== 'other') {
        endSelect.value = autoEnd;
        endInput.value = autoEnd;
        endInput.style.display = 'none';
        endInput.required = false;
      }
    });

    endSelect.addEventListener('change', function () {
      syncManualTimeInput(endSelect, endInput);
    });

    submitButton.addEventListener('click', function () {
      if (!form.reportValidity()) {
        return;
      }

      var type = typeInput.value;
      var status = statusInput.value;
      var start = startInput.value;
      var end = endInput.value;

      if (!start || !end) {
        alert('Please select both a start and end time.');
        return;
      }

      if (start >= end) {
        alert('End time must be after start time.');
        return;
      }

      FW.Progress.Load();

      var payload = {
        name: '',
        parent: config.parentId,
        status: status,
        date: config.date,
        dtend: config.date,
        date_time: start,
        dtend_time: end,
        cmd: 'save'
      };

      if (config.mode === 'edit') {
        payload.summary = config.summary;
        payload.category = config.category;
        payload.user = config.user;
        payload.timezone_id = config.timezoneId;
      } else {
        payload.summary = 'Personalized ' + type + ' for ' + config.preferred;
        payload.category = 'Personalized Campus Visit Related / ' + type;
        payload.user = config.currentUser;
        payload.timezone_id = 'Eastern Standard Time';
      }

      $.post(buildRequestUrl(config), payload)
        .done(function (response) {
          if (config.mode === 'edit') {
            FW.Progress.Unload();
            FW.Dialog.Unload();
            window.top.location.reload();
            return;
          }

          var relatedId = extractEventId(response);

          if (!relatedId) {
            FW.Progress.Unload();
            alert('The event was saved, but no event ID was returned.');
            return;
          }

          var formattedStart = formatTime(start);
          var relationSummary =
            formatDateAndTime(config.date, formattedStart) +
            ' - Personalized ' +
            type +
            ' for ' +
            config.preferred;

          $.ajax({
            type: 'POST',
            url: '?cmd=relate',
            data: {
              response: config.visit,
              field: config.relatedFieldId,
              summary: relationSummary,
              related: relatedId,
              registrant: config.registrant,
              cmd: 'relate'
            },
            dataType: 'html'
          })
            .done(function () {
              FW.Progress.Unload();
              FW.Dialog.Unload();
              window.location = window.location;
            })
            .fail(function (jqXHR, textStatus) {
              FW.Progress.Unload();
              alert('Event created, but relating it failed: ' + textStatus);
            });
        })
        .fail(function (jqXHR, textStatus) {
          FW.Progress.Unload();
          alert('Request failed: ' + textStatus);
        });
    });
  }

  window.PCCampusVisitEventPopup = {
    init: function (config) {
      bindPopup(config || {});
    }
  };
})(window, document, jQuery);
