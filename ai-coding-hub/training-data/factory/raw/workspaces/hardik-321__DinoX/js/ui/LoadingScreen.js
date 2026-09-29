export class LoadingScreen {

    static draw(ctx, canvas, message = "Loading...") {

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#1F2D3A";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 64px Arial";
        ctx.textAlign = "center";

        ctx.fillText(
            "DINOX",
            canvas.width / 2,
            canvas.height / 2 - 80
        );

        ctx.font = "28px Arial";

        ctx.fillText(
            message,
            canvas.width / 2,
            canvas.height / 2
        );

        ctx.fillStyle = "#555";

        ctx.fillRect(
            canvas.width / 2 - 150,
            canvas.height / 2 + 50,
            300,
            16
        );

        ctx.fillStyle = "#4CAF50";

        ctx.fillRect(
            canvas.width / 2 - 150,
            canvas.height / 2 + 50,
            300,
            16
        );

    }

}