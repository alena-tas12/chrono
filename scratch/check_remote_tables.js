const cloudDb = require('../main/cloudDb');

async function checkTables() {
    console.log("Checking remote profiles...");
    const { data: profiles, error: err1 } = await cloudDb.from('profiles').select('*').limit(1);
    console.log("Profiles check:", { success: !err1, error: err1?.message, data: profiles });

    console.log("Checking remote notes...");
    const { data: notes, error: err2 } = await cloudDb.from('notes').select('*').limit(1);
    console.log("Notes check:", { success: !err2, error: err2?.message, data: notes });

    console.log("Checking remote goals...");
    const { data: goals, error: err3 } = await cloudDb.from('goals').select('*').limit(1);
    console.log("Goals check:", { success: !err3, error: err3?.message, data: goals });

    process.exit(0);
}

checkTables();
