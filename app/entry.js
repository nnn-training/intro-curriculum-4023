'use strict'

import $ from "jquery";
globalThis.jQuery = $;

import 'bootstrap/dist/js/bootstrap.min.js';
import 'bootstrap/dist/css/bootstrap.min.css';

console.log('予定調整くんへようこそ！');
$('.ava-toggle-btn').each((i, e) => {
    const button = $(e); // button = JQuery式オブジェクト、e = DOMElement
    button.on('click', () => {
        const scheduleId = button.data('schedule-id');
        const candidateId = button.data('candidate-id');
        const availability = parseInt(button.data('availability'));
        const nextAvailability = (availability + 1) % 3;
        $.post(`/schedules/${scheduleId}/candidates/${candidateId}`,
            { availability: nextAvailability },
            (data) => {
                button.data('availability', data.availability);
                const availabilityLabels = ['欠席', '？', '出席'];
                button.text(availabilityLabels[data.availability]);
            }
        );
    });
});

const btn = $('#comment-btn');
btn.on('click',() => {
    const scheduleId = btn.data('schedule-id');
    const comment = prompt('コメントを255文字以内で入力: ');
    if (comment) {
        $.post(`/schedules/${scheduleId}/comments`,
            { comment: comment },
            (data) => { // WebAPIのレスポンスが入る
                $('#self-comment').text(data.comment);
            }
        );
    }
})