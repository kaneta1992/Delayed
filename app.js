function TestTextTexture() {
    let canvasText = document.createElement("canvas");
    canvasText.width = 1024;
    canvasText.height = 1024;
    //canvasText.hidden = true;
    context = canvasText.getContext('2d', {alpha: false});

    context.fillStyle = "white";
    context.font = "30px 'ＭＳ ゴシック'";
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillText("インターンは延期しました。大変申し訳ございません。", 0, 0, 1024);

    let texture = new Texture2D(1024, 1024);
    let imageData= context.getImageData(0, 0, 1024, 1024);
    texture.SetImageData(imageData, gl.UNSIGNED_BYTE);
    return texture;
}

function blur(x, y, src, dest, program) {
    dest.Bind();
    dest.SetViewport();

    program.Use();
    program.SendTexture2D("tex", src.texture, 0);
    program.Send2f("dstResolution", dest.width, dest.height);
    program.Send2f("srcResolution", src.width, src.height);
    program.Send2f("gaussianDir", x, y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    dest.texture.Bind();
    gl.generateMipmap(gl.TEXTURE_2D);
    dest.texture.UnBind();

    dest.UnBind();
}

function SetFilter(texture, mag, min) {
    texture.texture.Bind();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    texture.texture.UnBind();
}

window.onload = function () {
    let canvas = document.createElement("canvas");

    let w = window.innerWidth;
    let h = window.innerHeight;

    canvas.width = w;
    canvas.height = h;
    canvas.style.width = window.innerWidth+"px";
    canvas.style.height = window.innerHeight+"px";
    document.body.appendChild(canvas);

    gl = canvas.getContext("webgl2") || canvas.getContext("experimental-webgl2");

    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
      alert("need EXT_color_buffer_float");
      return;
    }

    const ext2 = gl.getExtension("OES_texture_float_linear");
    if (!ext2) {
        alert("need OES_texture_float_linear");
        return;
    }
    gl.getExtension('OES_texture_float');
    gl.getExtension('OES_texture_float_linear');
    const vertex = `
    #version 300 es
    void main()
    { 
        gl_Position = vec4(ivec2(gl_VertexID&1,gl_VertexID>>1)*2-1,0,1);
    }
    `

    let vertexShader = new Shader(vertex, gl.VERTEX_SHADER);
    let mainFragmentShader = new Shader(mainHeader.text + main.text, gl.FRAGMENT_SHADER);
    let mainReflectFragmentShader = new Shader(mainHeader.text + mainReflect.text, gl.FRAGMENT_SHADER);
    let fragmentShader = new Shader(fs.text, gl.FRAGMENT_SHADER);
    let fragmentShader2 = new Shader(fs2.text, gl.FRAGMENT_SHADER);
    let gaussianBlur7FragmentShader = new Shader(gaussianBlur7.text, gl.FRAGMENT_SHADER);

    let mainProgram = new ShaderProgram();
    let mainReflectProgram = new ShaderProgram();
    let program = new ShaderProgram();
    let program2 = new ShaderProgram();
    let gaussianBlur7Program = new ShaderProgram();

    mainProgram.Link(vertexShader, mainFragmentShader);
    mainReflectProgram.Link(vertexShader, mainReflectFragmentShader);
    program.Link(vertexShader, fragmentShader);
    program2.Link(vertexShader, fragmentShader2);
    gaussianBlur7Program.Link(vertexShader, gaussianBlur7FragmentShader);

    const renderTexture = new RenderTexture(canvas.width, canvas.height, gl.UNSIGNED_BYTE);
    const reflectTexture = new RenderTexture(canvas.width/1, canvas.height/1, gl.FLOAT);

    const blurTextureX1 = new RenderTexture(canvas.width/2, canvas.height/2, gl.FLOAT);
    const blurTextureY1 = new RenderTexture(canvas.width/2, canvas.height/2, gl.FLOAT);
    const blurTextureX2 = new RenderTexture(canvas.width/4, canvas.height/4, gl.FLOAT);
    const blurTextureY2 = new RenderTexture(canvas.width/4, canvas.height/4, gl.FLOAT);
    const blurTextureX3 = new RenderTexture(canvas.width/8, canvas.height/8, gl.FLOAT);
    const blurTextureY3 = new RenderTexture(canvas.width/8, canvas.height/8, gl.FLOAT);
    const blurTextureX4 = new RenderTexture(canvas.width/16, canvas.height/16, gl.FLOAT);
    const blurTextureY4 = new RenderTexture(canvas.width/16, canvas.height/16, gl.FLOAT);
    const blurTextureX5 = new RenderTexture(canvas.width/32, canvas.height/32, gl.FLOAT);
    const blurTextureY5 = new RenderTexture(canvas.width/32, canvas.height/32, gl.FLOAT);

    const texture = TestTextTexture();

    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);

    let zero = Date.now();
    (function () {
        // Reflect
        reflectTexture.Bind();
        reflectTexture.SetViewport();

        mainReflectProgram.Use();
        mainReflectProgram.Send2f("iResolution", reflectTexture.width, reflectTexture.height);
        mainReflectProgram.Send2f("fullResolution", canvas.width, canvas.height);
        mainReflectProgram.Send1f("iTime", (Date.now() - zero) * 0.001);
        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        reflectTexture.texture.Bind();
        gl.generateMipmap(gl.TEXTURE_2D);
        reflectTexture.texture.UnBind();

        reflectTexture.UnBind();


        //Blur
        blur(1, 0, reflectTexture, blurTextureX1, gaussianBlur7Program);
        blur(0, 1, blurTextureX1, blurTextureY1, gaussianBlur7Program);

        blur(1, 0, blurTextureY1, blurTextureX2, gaussianBlur7Program);
        blur(0, 1, blurTextureX2, blurTextureY2, gaussianBlur7Program);

        blur(1, 0, blurTextureY2, blurTextureX3, gaussianBlur7Program);
        blur(0, 1, blurTextureX3, blurTextureY3, gaussianBlur7Program);

        blur(1, 0, blurTextureY3, blurTextureX4, gaussianBlur7Program);
        blur(0, 1, blurTextureX4, blurTextureY4, gaussianBlur7Program);

        blur(1, 0, blurTextureY4, blurTextureX5, gaussianBlur7Program);
        blur(0, 1, blurTextureX5, blurTextureY5, gaussianBlur7Program);

        //SetFilter(blurTextureY3, gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR);

        // Lighting
        renderTexture.Bind();
        renderTexture.SetViewport();

        /*
        program.Use();
        program.Send2f("resolution", renderTexture.width, renderTexture.height);
        program.Send2f("fullResolution", canvas.width, canvas.height);
        program.SendTexture2D("tex", texture, 0);
        program.Send1f("time", (Date.now() - zero) * 0.001);
        */
        mainProgram.Use();
        mainProgram.Send2f("iResolution", renderTexture.width, renderTexture.height);
        mainProgram.Send2f("fullResolution", canvas.width, canvas.height);
        mainProgram.Send1f("iTime", (Date.now() - zero) * 0.001);
        program2.SendTexture2D("reflectTexture", blurTextureY3.texture, 0);
        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        renderTexture.UnBind();


        renderTexture.texture.Bind();
        gl.generateMipmap(gl.TEXTURE_2D);
        renderTexture.texture.UnBind();


        program2.Use();
        program2.Send2f("resolution", canvas.width, canvas.height);
        program2.SendTexture2D("tex", renderTexture.texture, 0);
        gl.viewport(0.0, 0.0, canvas.width, canvas.height);
        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        //console.log(gl.getError());
        

        requestAnimationFrame(arguments.callee);
    })();
};