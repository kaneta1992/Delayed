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
    program.Send2f("resolution", dest.width, dest.height);
    program.Send2f("gaussianDir", x, y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    dest.UnBind();
}

function reflectionBlur(x, y, src, dest, program, gBufferTextures) {
    dest.Bind();
    dest.SetViewport();

    program.Use();
    program.SendTexture2D("tex", src.texture, 0);
    program.Send2f("resolution", dest.width, dest.height);
    program.Send2f("blurDir", x, y);
    program.SendTexture2D("depthNormalTexture", gBufferTextures.texture0, 1);
    program.SendTexture2D("roughnessTexture", gBufferTextures.texture1, 2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    dest.UnBind();
}

function SetFilter(texture, mag, min) {
    texture.Bind();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    texture.UnBind();
}

function copyTexture(src, dest, program) {
    dest.Bind();
    dest.SetViewport();

    program.Use();
    program.Send2f("resolution", dest.width, dest.height);
    program.SendTexture2D("tex", src.texture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    dest.UnBind();
}

function copyTexture2(src, dest, program) {
    dest.Bind();
    dest.SetViewport();

    program.Use();
    program.Send2f("resolution", dest.width, dest.height);
    program.SendTexture2D("tex", src, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    dest.UnBind();
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
    let fragmentShader2 = new Shader(combine.text, gl.FRAGMENT_SHADER);
    let copyFragmentShader = new Shader(copy.text, gl.FRAGMENT_SHADER);
    let gaussianFragmentShader = new Shader(gaussian.text, gl.FRAGMENT_SHADER);
    let sumBloomFragmentShader = new Shader(sumBloom.text, gl.FRAGMENT_SHADER);
    let gBufferShader = new Shader(mainHeader.text + GBuffer.text, gl.FRAGMENT_SHADER);
    let blurShader = new Shader(blur50.text, gl.FRAGMENT_SHADER);
    let DOFShader = new Shader(DOF.text, gl.FRAGMENT_SHADER);
    let nearShader = new Shader(extractNear.text, gl.FRAGMENT_SHADER);
    let farShader = new Shader(extractFar.text, gl.FRAGMENT_SHADER);
    let DOFCombineShader = new Shader(DOFCombine.text, gl.FRAGMENT_SHADER);
    let postProcessShader = new Shader(postProcess.text, gl.FRAGMENT_SHADER);

    let mainProgram = new ShaderProgram();
    let mainReflectProgram = new ShaderProgram();
    let program = new ShaderProgram();
    let program2 = new ShaderProgram();
    let copyProgram = new ShaderProgram();
    let gaussianProgram = new ShaderProgram();
    let sumBloomProgram = new ShaderProgram();
    let gBufferProgram = new ShaderProgram();
    let blurProgram = new ShaderProgram();
    let DOFProgram = new ShaderProgram();
    let nearProgram = new ShaderProgram();
    let farProgram = new ShaderProgram();
    let DOFCombineProgram = new ShaderProgram();
    let postProcessProgram = new ShaderProgram();

    mainProgram.Link(vertexShader, mainFragmentShader);
    mainReflectProgram.Link(vertexShader, mainReflectFragmentShader);
    program.Link(vertexShader, fragmentShader);
    program2.Link(vertexShader, fragmentShader2);
    copyProgram.Link(vertexShader, copyFragmentShader);
    gaussianProgram.Link(vertexShader, gaussianFragmentShader);
    sumBloomProgram.Link(vertexShader, sumBloomFragmentShader);
    gBufferProgram.Link(vertexShader, gBufferShader);
    blurProgram.Link(vertexShader, blurShader);
    DOFProgram.Link(vertexShader, DOFShader);
    nearProgram.Link(vertexShader, nearShader);
    farProgram.Link(vertexShader, farShader);
    DOFCombineProgram.Link(vertexShader, DOFCombineShader);
    postProcessProgram.Link(vertexShader, postProcessShader);

    const renderTexture = new MRTTexture2(canvas.width, canvas.height, gl.FLOAT);
    const reflectTexture = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);

    const blurTextureX6 = new RenderTexture(canvas.width/2, canvas.height/2, gl.FLOAT);
    const blurTextureY6 = new RenderTexture(canvas.width/2, canvas.height/2, gl.FLOAT);

    const bloomTextureX1 = new RenderTexture(canvas.width/2, canvas.height/2, gl.FLOAT);
    const bloomTextureY1 = new RenderTexture(canvas.width/2, canvas.height/2, gl.FLOAT);
    const bloomTextureX2 = new RenderTexture(canvas.width/4, canvas.height/4, gl.FLOAT);
    const bloomTextureY2 = new RenderTexture(canvas.width/4, canvas.height/4, gl.FLOAT);
    const bloomTextureX3 = new RenderTexture(canvas.width/8, canvas.height/8, gl.FLOAT);
    const bloomTextureY3 = new RenderTexture(canvas.width/8, canvas.height/8, gl.FLOAT);
    const bloomTextureX4 = new RenderTexture(canvas.width/16, canvas.height/16, gl.FLOAT);
    const bloomTextureY4 = new RenderTexture(canvas.width/16, canvas.height/16, gl.FLOAT);
    const bloomTextureX5 = new RenderTexture(canvas.width/32, canvas.height/32, gl.FLOAT);
    const bloomTextureY5 = new RenderTexture(canvas.width/32, canvas.height/32, gl.FLOAT);

    const nearTexture = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);
    const farTexture = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);
    const DOFFarTexture = new RenderTexture(canvas.width/2, canvas.height/2, gl.FLOAT);
    const DOFNearTexture = new RenderTexture(canvas.width/3, canvas.height/3, gl.FLOAT);
    const DOFCombineTexture = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);

    const prePostProcessTexture = new RenderTexture(canvas.width, canvas.height, gl.FLOAT);

    const gBufferTextures = new MRTTexture2(canvas.width, canvas.height, gl.FLOAT);

    SetFilter(gBufferTextures.texture0, gl.NEAREST, gl.NEAREST);
    SetFilter(gBufferTextures.texture1, gl.NEAREST, gl.NEAREST);
    SetFilter(renderTexture.texture0, gl.NEAREST, gl.NEAREST);
    SetFilter(renderTexture.texture1, gl.NEAREST, gl.NEAREST);
    //SetFilter(DOFTexture.texture, gl.NEAREST, gl.NEAREST);

    const texture = TestTextTexture();

    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);

    let zero = Date.now();
    (function () {
        requestAnimationFrame(arguments.callee);
        // GBuffer
        gBufferTextures.Bind();
        gBufferTextures.SetViewport();

        gBufferProgram.Use();
        gBufferProgram.Send2f("iResolution", gBufferTextures.width, gBufferTextures.height);
        gBufferProgram.Send2f("fullResolution", canvas.width, canvas.height);
        gBufferProgram.Send1f("iTime", (Date.now() - zero) * 0.001);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gBufferTextures.UnBind();

        // Reflect
        reflectTexture.Bind();
        reflectTexture.SetViewport();

        mainReflectProgram.Use();
        mainReflectProgram.Send2f("iResolution", reflectTexture.width, reflectTexture.height);
        mainReflectProgram.Send2f("fullResolution", canvas.width, canvas.height);
        mainReflectProgram.Send1f("iTime", (Date.now() - zero) * 0.001);
        mainReflectProgram.SendTexture2D("depthNormalTexture", gBufferTextures.texture0, 0);
        mainReflectProgram.SendTexture2D("roughnessTexture", gBufferTextures.texture1, 1);
        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        reflectTexture.texture.GenerateMipMap();

        reflectTexture.UnBind();


        //Blur
        //copyTexture(reflectTexture, blurTextureY6, copyProgram);
        reflectionBlur(0.5, 0, reflectTexture, blurTextureX6, blurProgram, gBufferTextures);
        reflectionBlur(0, 1, blurTextureX6, blurTextureY6, blurProgram, gBufferTextures);

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
        mainProgram.SendTexture2D("reflectTexture", blurTextureY6.texture, 0);
        mainProgram.SendTexture2D("roughnessTexture", gBufferTextures.texture1, 1);
        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        renderTexture.UnBind();

        farTexture.Bind();
        farTexture.SetViewport();
        farProgram.Use();
        farProgram.Send2f("resolution", farTexture.width, farTexture.height);
        farProgram.SendTexture2D("tex", renderTexture.texture0, 0);
        farProgram.SendTexture2D("depthNormalTexture", renderTexture.texture1, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        farTexture.UnBind();

        nearTexture.Bind();
        nearTexture.SetViewport();
        nearProgram.Use();
        nearProgram.Send2f("resolution", nearTexture.width, nearTexture.height);
        nearProgram.SendTexture2D("tex", renderTexture.texture0, 0);
        nearProgram.SendTexture2D("depthNormalTexture", renderTexture.texture1, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        nearTexture.UnBind();

        DOFFarTexture.Bind();
        DOFFarTexture.SetViewport();
        DOFProgram.Use();
        DOFProgram.Send2f("resolution", DOFFarTexture.width, DOFFarTexture.height);
        DOFProgram.SendTexture2D("tex", farTexture.texture, 0);
        DOFProgram.SendTexture2D("depthNormalTexture", renderTexture.texture1, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        DOFFarTexture.UnBind();

        DOFNearTexture.Bind();
        DOFNearTexture.SetViewport();
        DOFProgram.Use();
        DOFProgram.Send2f("resolution", DOFNearTexture.width, DOFNearTexture.height);
        DOFProgram.SendTexture2D("tex", nearTexture.texture, 0);
        DOFProgram.SendTexture2D("depthNormalTexture", renderTexture.texture1, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        DOFNearTexture.UnBind();

        DOFCombineTexture.Bind();
        DOFCombineTexture.SetViewport();
        DOFCombineProgram.Use();
        DOFCombineProgram.Send2f("resolution", DOFCombineTexture.width, DOFCombineTexture.height);
        DOFCombineProgram.SendTexture2D("tex", renderTexture.texture0, 0);
        DOFCombineProgram.SendTexture2D("depthNormalTexture", renderTexture.texture1, 1);
        DOFCombineProgram.SendTexture2D("DOFFarTexture", DOFFarTexture.texture, 2);
        DOFCombineProgram.SendTexture2D("DOFNearTexture", DOFNearTexture.texture, 3);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        DOFCombineTexture.UnBind();

        //Bloom
        copyTexture2(renderTexture.texture0, bloomTextureY1, copyProgram);
        blur(1, 0, bloomTextureY1, bloomTextureX1, gaussianProgram);
        blur(0, 1, bloomTextureX1, bloomTextureY1, gaussianProgram);

        copyTexture(bloomTextureY1, bloomTextureY2, copyProgram);
        blur(2, 0, bloomTextureY2, bloomTextureX2, gaussianProgram);
        blur(0, 2, bloomTextureX2, bloomTextureY2, gaussianProgram);

        copyTexture(bloomTextureY2, bloomTextureY3, copyProgram);
        blur(2, 0, bloomTextureY3, bloomTextureX3, gaussianProgram);
        blur(0, 2, bloomTextureX3, bloomTextureY3, gaussianProgram);

        copyTexture(bloomTextureY3, bloomTextureY4, copyProgram);
        blur(4, 0, bloomTextureY4, bloomTextureX4, gaussianProgram);
        blur(0, 4, bloomTextureX4, bloomTextureY4, gaussianProgram);

        copyTexture(bloomTextureY4, bloomTextureY5, copyProgram);
        blur(4, 0, bloomTextureY5, bloomTextureX5, gaussianProgram);
        blur(0, 4, bloomTextureX5, bloomTextureY5, gaussianProgram);

        sumBloomProgram.Use();
        bloomTextureX1.Bind();
        bloomTextureX1.SetViewport();
        sumBloomProgram.Send2f("resolution", bloomTextureX1.width, bloomTextureX1.height);
        sumBloomProgram.SendTexture2D("tex1", bloomTextureY1.texture, 0);
        sumBloomProgram.SendTexture2D("tex2", bloomTextureY2.texture, 1);
        sumBloomProgram.SendTexture2D("tex3", bloomTextureY3.texture, 2);
        sumBloomProgram.SendTexture2D("tex4", bloomTextureY4.texture, 3);
        sumBloomProgram.SendTexture2D("tex5", bloomTextureY5.texture, 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        bloomTextureX1.UnBind();

        prePostProcessTexture.Bind();
        prePostProcessTexture.SetViewport();
        program2.Use();
        program2.Send2f("resolution", canvas.width, canvas.height);
        program2.SendTexture2D("tex", DOFCombineTexture.texture, 0);
        program2.SendTexture2D("bloomTex", bloomTextureX1.texture, 1);
        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        prePostProcessTexture.UnBind();

        postProcessProgram.Use();
        postProcessProgram.Send2f("resolution", canvas.width, canvas.height);
        postProcessProgram.SendTexture2D("tex", prePostProcessTexture.texture, 0);
        gl.viewport(0.0, 0.0, canvas.width, canvas.height);
        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        //console.log(gl.getError());
    })();
};