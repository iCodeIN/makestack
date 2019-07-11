const cli = require("caporal");
const admin = require("firebase-admin");

function main(args, opts) {
    console.log("==> Starting...");
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: "makestack-test",
//        databaseURL: opts.databaseUrl,
    });

    const db = admin.firestore();
    const publish = () => {
        const doc = ((new Date()).getTime() / 1000).toString();
        const data = {
            device: "send-test-data.js",
            int_value: Math.random() * 100,
            name: "rand",
            str_value: "this is a string",
            published_at: new Date(),
        };

        console.log(`==> Sending a dummy event ${doc}...`);
        db.collection("events").doc(doc).set(data);
    };

    publish();
    setInterval(() => {
        publish();
    }, 15000);
}

cli
    .option("--database-url <url>", "The firebase database URL.", null, null, true)
    .action((args, opts) => {
        main(args, opts);
    });

cli.parse(process.argv);
