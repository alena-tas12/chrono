/**
 * 📅 CALENDAR INTELLIGENCE ENGINE
 * Handles algorithmic spaced study block scheduling and calendar constraint validation.
 */

function generateSpacedStudyBlocks(subject, examDateStr) {
    const examDate = new Date(examDateStr);
    const studyProposals = [];

    // Helper to format date
    const formatDate = (d) => d.toISOString().split('T')[0];

    // Add main Exam task
    studyProposals.push({
        type: 'add',
        text: `Exam: ${subject}`,
        date: examDateStr,
        calendar: 'personal',
        start_time: '09:00',
        duration_min: 120
    });

    // 1. Spaced Block A: 4 Days Before (Core Comprehension Focus - 120 mins)
    const dateA = new Date(examDate);
    dateA.setDate(dateA.getDate() - 4);
    studyProposals.push({
        type: 'add',
        text: `Study Core: ${subject}`,
        date: formatDate(dateA),
        calendar: 'study',
        start_time: '15:00',
        duration_min: 120
    });

    // 2. Spaced Block B: 2 Days Before (Active Recall / Practice - 90 mins)
    const dateB = new Date(examDate);
    dateB.setDate(dateB.getDate() - 2);
    studyProposals.push({
        type: 'add',
        text: `Active Practice: ${subject}`,
        date: formatDate(dateB),
        calendar: 'study',
        start_time: '16:00',
        duration_min: 90
    });

    // 3. Spaced Block C: 1 Day Before (Final Review / Micro revision - 60 mins)
    const dateC = new Date(examDate);
    dateC.setDate(dateC.getDate() - 1);
    studyProposals.push({
        type: 'add',
        text: `Final Review: ${subject}`,
        date: formatDate(dateC),
        calendar: 'study',
        start_time: '16:00',
        duration_min: 60
    });

    // 4. Protected Rest Block on Exam Day Afternoon
    studyProposals.push({
        type: 'add',
        text: `Post-Exam Rest & Recharge`,
        date: examDateStr,
        calendar: 'focus',
        start_time: '14:00',
        duration_min: 90
    });

    return studyProposals;
}

module.exports = {
    generateSpacedStudyBlocks
};
