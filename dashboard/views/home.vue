<template>
<div>
    <h2>MakeStack Dashboard</h2>
    <hr>
    <div style="width:600px; height: 400px">
        <canvas id="chart"></canvas>
    </div>
</div>
</template>

<script lang="ts">
import Vue from "vue"
import Component from "vue-class-component"
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import Chart from 'chart.js';

@Component({
})
export default class Home extends Vue {
    mounted() {
        const config = {
        };

        const project = firebase.initializeApp(config);
        const db = firebase.firestore();

        const chart = new Chart(document.getElementById("chart"), {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "rand",
                        data: [],
                    }
                ]
            },
            options: {
                elements: {
                    line: {
                        tension: 0
                    }
                },
                scales: {
                    xAxes: [{
                        type: "time",
                        time: {
                            unit: "second"
                        }
                    }]
                }
            }
        });

        db.collection("events")
            .onSnapshot((snapshot) => {
                for (const change of snapshot.docChanges()) {
                    if (change.type === "added") {
                        const id = change.doc.id;
                        const { name, device, int_value, published_at } = change.doc.data();
                        console.log(published_at, id, device, name, int_value);
                        chart.data.labels.push(new Date(published_at.seconds * 1000));
                        chart.data.datasets[0].data.push(int_value);
                    }
                }

                chart.update();
            });
    }
}
</script>

<style lang="scss" scoped>
</style>
