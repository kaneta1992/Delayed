function TestTextTexture() {
    let canvasText = document.createElement("canvas");
    canvasText.width = 1024;
    canvasText.height = 1024;
    //canvasText.hidden = true;
    context = canvasText.getContext('2d');

    context.fillStyle = "white";
    context.font = "30px 'ＭＳ ゴシック'";
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillText("インターンは延期しました。大変申し訳ございません。", 0, 0, 1024);

    const texture = gl.createTexture(1024, 1024);
    let imageData= context.getImageData(0, 0, 1024, 1024);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}

window.onload = function () {
    let canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = window.innerWidth+"px";
    canvas.style.height = window.innerHeight+"px";
    document.body.appendChild(canvas);

    gl = canvas.getContext("webgl2") || canvas.getContext("experimental-webgl2");

    vertex = `
    #version 300 es
    void main()
    { 
        gl_Position = vec4(ivec2(gl_VertexID&1,gl_VertexID>>1)*2-1,0,1);
    }
    `

    vertexShader = new Shader(vertex, gl.VERTEX_SHADER);
    fragmentShader = new Shader(fs.text, gl.FRAGMENT_SHADER);
    program = new ShaderProgram();

    program.Link(vertexShader, fragmentShader);
    program.Use();
    program.Send2f("resolution", canvas.width, canvas.height);

    const texture = TestTextTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    program.Send1i("tex", 0);

    let zero = Date.now();
    (function () { 
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        program.Send1f("time", (Date.now() - zero) * 0.001);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(arguments.callee);
    })();
};