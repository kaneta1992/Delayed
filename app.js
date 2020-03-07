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

    let texture = new Texture2D(1024, 1024);
    let imageData= context.getImageData(0, 0, 1024, 1024);
    texture.SetImageData(imageData);
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

    const vertex = `
    #version 300 es
    void main()
    { 
        gl_Position = vec4(ivec2(gl_VertexID&1,gl_VertexID>>1)*2-1,0,1);
    }
    `

    let vertexShader = new Shader(vertex, gl.VERTEX_SHADER);
    let fragmentShader = new Shader(fs.text, gl.FRAGMENT_SHADER);
    let fragmentShader2 = new Shader(fs2.text, gl.FRAGMENT_SHADER);
    let program = new ShaderProgram();
    let program2 = new ShaderProgram();

    program.Link(vertexShader, fragmentShader);
    program2.Link(vertexShader, fragmentShader2);


    const renderTexture = new RenderTexture(canvas.width/2, canvas.height/2);
    const texture = TestTextTexture();

    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);

    let zero = Date.now();
    (function () { 
        renderTexture.Bind();
        renderTexture.SetViewport();

        program.Use();
        program.Send2f("resolution", renderTexture.width, renderTexture.height);
        program.Send2f("fullResolution", canvas.width, canvas.height);
        program.SendTexture2D("tex", texture, 0);
        program.Send1f("time", (Date.now() - zero) * 0.001);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        renderTexture.UnBind();

        /*
        renderTexture.texture.Bind();
        gl.generateMipmap(gl.TEXTURE_2D);
        renderTexture.texture.UnBind();
        */

        program2.Use();
        program2.Send2f("resolution", canvas.width, canvas.height);
        program2.SendTexture2D("tex", renderTexture.texture, 0);
        gl.viewport(0.0, 0.0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        //console.log(gl.getError());
        

        requestAnimationFrame(arguments.callee);
    })();
};