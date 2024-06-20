// ==UserScript==
// @name        知乎推荐流优化
// @namespace   ZhihuFeedOptimization
// @license     GPLv3
// @match       https://www.zhihu.com/
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// @grant       GM_unregisterMenuCommand
// @version     0.3.1
// @run-at      document-idle
// @author      lisolaris
// @icon        https://www.google.com/s2/favicons?sz=64&domain=zhihu.com
// @description 优化知乎首页推荐流的内容，如移除灌水用户、按屏蔽词屏蔽等
// @downloadURL https://update.greasyfork.org/scripts/498139/%E7%9F%A5%E4%B9%8E%E6%8E%A8%E8%8D%90%E6%B5%81%E4%BC%98%E5%8C%96.user.js
// @updateURL https://update.greasyfork.org/scripts/498139/%E7%9F%A5%E4%B9%8E%E6%8E%A8%E8%8D%90%E6%B5%81%E4%BC%98%E5%8C%96.user.js
// ==/UserScript==

(function () {
    'use strict';

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const DEFAULTAVATARHASH = "abed1a8c04700ba7d72b45195223e0ff";

    const userChecked = new Set();
    const cardsToBeDeletedWithBannedWord = new Set();
    const cardsToBeDeletedWithDefaultAvatar = new Set();

    const bannedWords = new Set();
    var bannedWordsJson = GM_getValue("bannedWords", "");
    if (bannedWordsJson.length)
        for (let word of JSON.parse(bannedWordsJson)) 
            bannedWords.add(word);

    var newCardsThreshold = parseInt(GM_getValue("newCardsThreshold", "5"));
    var answerCountThreshold = parseInt(GM_getValue("answerCountThreshold", "100"));
    var usernameAuxJudgment = parseInt(GM_getValue("usernameAuxJudgment", "1"));
    var autoSendUninterestWithBannedWordCard = parseInt(GM_getValue("autoSendUninterestWithBannedWordCard", "1"));

    function checkIfBannedWordInCard(newCards){
        for (let card of newCards){
            // 检查标题是否含有用户屏蔽词
            for (let word of bannedWords){
                if (card.querySelector("h2").textContent.includes(word)){
                    let cardItem = card.querySelector("div.ContentItem");
                    let extraInfo = JSON.parse(cardItem.getAttribute("data-za-extra-module"));
                    let userId = extraInfo.card.content.author_member_hash_id;
                    console.log(`%c知乎推荐流优化 待删除列表中加入: ${userId}, 原因: 用户屏蔽词 ${word}`, "color:#00A2E8");
                    cardsToBeDeletedWithBannedWord.add(card);
                    break;
                }
            }
        }
    }

    async function checkIfAuthorDefaultAvatarInCard(newCards){
        const fetchPromises = [];
        for (let card of newCards) {
            // 每个内容卡片都具有class: "ContentItem ArticleItem"或"ContentItem AnswerItem"
            // 或是被推送到首页的专栏链接 也会有ContentItem属性
            let cardItem = card.querySelector("div.ContentItem");
            // let cardType = cardItem.className.includes("AnswerItem") ? "answer" : "article";
            let extraInfo = JSON.parse(cardItem.getAttribute("data-za-extra-module"));
            let userId = extraInfo.card.content.author_member_hash_id;

            // 此用户已经被检查过/将要检查的卡片已经在待删除列表里 跳过检查
            if (userChecked.has(userId) || cardsToBeDeletedWithBannedWord.has(card) || cardsToBeDeletedWithDefaultAvatar.has(card)) continue;
            else {
                try{
                    // console.log("知乎推荐流优化 查询用户 " + userId);
                    fetchPromises.push(
                        fetch(`https://api.zhihu.com/people/${userId}/profile?profile_new_version=1`)
                            .then(response => response.json())
                            .then(data => {
                                // data.error: 大量请求知乎api后被反爬虫识别 需要到所给出的页面中进行真人验证
                                if (data.error){
                                    alert("知乎推荐流优化 需要进行真人验证，请在打开的窗口中完成！");
                                    window.open(data.error.redirect);
                                }
                                else {
                                    // console.log("用户 " + userId + " 头像URL " + data.avatar_url_template);
                                    // 判定条件: 是默认头像 且 (回答数小于设定阈值 或 (用户是否启用 与 以“知乎用户”为用户名的开头))
                                    // 真值表参见说明文档
                                    if (data.avatar_url_template.toLowerCase().includes(DEFAULTAVATARHASH) &&
                                        (data.answer_count < answerCountThreshold || (usernameAuxJudgment && data.name.search(/^知乎用户/) == 0))){
                                            // if (!(cardType === "article" && data.favorited_count > 50)){
                                                console.log(`%c知乎推荐流优化 待删除列表中加入: ${userId}, 原因: 默认头像${(data.name.search(/^知乎用户/) == 0) ? ' 默认用户名': ''}, 用户回答数量: ${data.answer_count}`, "color:#00A2E8");
                                                cardsToBeDeletedWithDefaultAvatar.add(card);
                                            // }
                                    } 
                                    else{
                                        userChecked.add(userId.toLowerCase());
                                    }
                                }
                            })
                            .catch(error => {
                                console.error('发生错误：', error);
                            })
                    );
                }
                catch (e){
                    console.error(e);
                }
            }
        }
        await Promise.all(fetchPromises);

        console.log("知乎推荐流优化 完成检查");
        removeCard();
        fetchPromises.length = 0;
    }

    function removeCard() {
        // 经测试不能直接通过xhr请求向知乎api发送不感兴趣 只能通过模拟点击来实现
        // function sendUninterestRequest(itemId){
        //     let payload = `item_brief=%7B%22source%22%3A+%22TS%22%2C+%22type%22%3A+%22answer%22%2C+%22id%22%3A+${itemId}%7D`;
        //     const xhr = new XMLHttpRequest();
        //     xhr.open("POST", "https://www.zhihu.com/api/v3/feed/topstory/uninterestv2", true);
        //     xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
        //     xhr.setRequestHeader("Cookie", document.cookie);
        //     xhr.send(payload);
        // }

        if (cardsToBeDeletedWithBannedWord.size + cardsToBeDeletedWithDefaultAvatar.size > 0){
            console.log("知乎推荐流优化 开始移除卡片");

            // 研究了一圈似乎js并没有类似python中enumerate()这样的额外赋值枚举功能 先这样写着看看以后能不能找到更好的方法
            for (let cardSet of [cardsToBeDeletedWithBannedWord, cardsToBeDeletedWithDefaultAvatar]){
                for (let card of cardSet){
                    let cardItem = card.querySelector("div.ContentItem");
                    let text = card.querySelector("span.RichText.ztext.CopyrightRichText-richText").textContent;
                    const urls = [];
                    if (card.querySelectorAll("meta[itemprop='url']").length != 0){
                        for (let url of card.querySelectorAll("meta[itemprop='url']")){
                            urls.push(url.getAttribute("content"));
                        }
                    }
                    // 对来自屏蔽词的卡片点击不感兴趣
                    if (cardSet === cardsToBeDeletedWithBannedWord && autoSendUninterestWithBannedWordCard){
                        const floatLayerMenuObConfig = {attributes: false, childList: true, subtree: false};
                        const floatLayerMenuObserver = new MutationObserver(function(mutationRecords, observer){
                            for (let mutation of mutationRecords){
                                if (mutation.addedNodes.length != 0){
                                    let popWind = mutation.addedNodes[0].querySelector("div.Popover-content");
                                    if (popWind){
                                        for (let button of popWind.querySelectorAll("button.AnswerItem-selfMenuItem")){
                                            if (button.innerText === "不感兴趣"){
                                                button.click();
                                                isNotInterested = true;
                                            }
                                        }
                                    }
                                }
                            }
                            observer.disconnect();
                        });
                        floatLayerMenuObserver.observe(document.body, floatLayerMenuObConfig);
                        // 在开始监视后再点击按钮
                        card.querySelector("button.Button.OptionsButton").click();
                    }
                    console.log(`%c知乎推荐流优化 已移除卡片: ${cardItem.getAttribute("data-zop")}, 原链接: ${JSON.stringify(urls)}, 预览: ${text}, 已不感兴趣: ${autoSendUninterestWithBannedWordCard ? "是" : "否"}`, "color:#FF00FF");
                    // 不可使用card.remove() 会导致点击首页顶部推荐按钮刷新页面时出错（removeChild()失败）
                    card.setAttribute("hidden", "")
                }
            }
            cardsToBeDeletedWithBannedWord.clear();
            cardsToBeDeletedWithDefaultAvatar.clear();
        }
    }

    function showArrayContent() {
        console.log(`cardsToBeDeletedWithBannedWord(${cardsToBeDeletedWithBannedWord.size}): ` + JSON.stringify(Array.from(cardsToBeDeletedWithBannedWord)));
        console.log(`cardsToBeDeletedWithDefaultAvatar(${cardsToBeDeletedWithDefaultAvatar.size}): ` + JSON.stringify(Array.from(cardsToBeDeletedWithDefaultAvatar)));
        console.log(`userChecked(${userChecked.size}): ` + JSON.stringify(Array.from(userChecked)));
    }

    async function checkCards(newCards=null){
        var cards;
        if (!newCards) cards = Array.from(document.getElementsByClassName("Card TopstoryItem TopstoryItem-isRecommend"));
        else cards = newCards;

        // 快速等待100ms 卡片子元素的属性添加完毕后再做检查
        await sleep(100);
        console.log("知乎推荐流优化 检查新获得的推荐卡片列表……");
        checkIfBannedWordInCard(cards);
        checkIfAuthorDefaultAvatarInCard(cards);
    }

    // 当检查到推荐流列表发生更新时的回调函数
    // 在新增的卡片超过五个后即将新增的卡片传入findDefaultAvatarCard()对作者头像进行检查
    function isNodeAddedCallback(mutationRecords, observer){
        const newAddedCards = new Set();

        for (let mutation of mutationRecords){
            if (mutation.addedNodes.length != 0)
                if (mutation.addedNodes[0].className === "Card TopstoryItem TopstoryItem-isRecommend")
                    newAddedCards.add(mutation.addedNodes[0]);
        }

        if (newAddedCards.size >= newCardsThreshold){
            checkCards(Array.from(newAddedCards));
            newAddedCards.clear();
        }
    }

    // 不知道为什么卡片中data-za-extra-module这个属性会在整个页面的DOM树加载完成后才被添加进去
    // 使用MutationServer对页面中第一个卡片的属性进行监视 待此属性被添加后即对首页的卡片进行检查
    // 不可避免地有感知（能看到卡片突然从眼前消失）
    function pageReloadCheck(){
        console.log("知乎推荐流优化 开始页面重加载后检查");
        const pageReloadCheckObConfig = {attributes: true, childList: false, subtree: false};
        const pageReloadCheckObserver = new MutationObserver(pageReloadCheckCallback);
        const pageReloadCheckContentItemElem = document.querySelector("div.ContentItem");
        pageReloadCheckObserver.observe(pageReloadCheckContentItemElem, pageReloadCheckObConfig);
    }

    function pageReloadCheckCallback(mutationRecords, observer){
        for (let mutation of mutationRecords)
            if (mutation.attributeName === "data-za-extra-module"){
                // console.log(mutation);
                checkCards();
                // 仅用于第一次加载/刷新时对页面最顶上的几个卡片进行检查 完成后即停止MutationObserver的监视
                observer.disconnect();
            }
    }

    // 油猴菜单与初始化日志相关代码 以IIFE函数的形式封装方便折叠
    (function (){
        var setNewCardsCountThresholdMenuId = null;
        var setAnswerCountThresholdMenuId = null;
        var toggleUsernameAuxJudgmentMenuId = null;
        var toggleAutoSendUninterestMenuId = null;

        function menuAddBannedWords(){
            let words = prompt("请输入屏蔽词，输入多个时以','分隔: ");
            // console.log("知乎推荐流优化 用户输入: " + words);
            if (words){
                words = words.replaceAll(/\s*/g,"").replaceAll("，", ",");

                let wordlist = words.split(",");
                for (let w of wordlist) bannedWords.add(w);

                bannedWordsJson = JSON.stringify(Array.from(bannedWords));
                console.log("知乎推荐流优化 用户屏蔽词库: " + bannedWordsJson);
                GM_setValue("bannedWords", bannedWordsJson);
                alert(`知乎推荐流优化 已添加屏蔽词: ${JSON.stringify(wordlist)} \n当前屏蔽词库: ${bannedWordsJson}`);
            }
        }

        function menuRemoveBannedWords(){
            let words = prompt("知乎推荐流优化 请输入要移除的屏蔽词，输入多个时以','分隔: \n可通过输入“清空全部屏蔽词！”来清空已设置的屏蔽词库 ");
            // console.log("知乎推荐流优化 用户输入: " + words);
            if (words){
                if (words === "清空全部屏蔽词！"){
                    if (confirm("知乎推荐流优化 确定要清空屏蔽词列表吗？")){
                        bannedWordsJson = "[]";
                        bannedWords.clear();
                        GM_setValue("bannedWords", bannedWordsJson);
                        alert("知乎推荐流优化 已清空屏蔽词列表");
                        console.log("知乎推荐流优化 用户屏蔽词库: " + bannedWordsJson);
                    }
                }
                else{
                    words = words.replaceAll(/\s*/g,"").replaceAll("，", ",");
                    let wordlist = words.split(",");
                    for (let w of wordlist) bannedWords.delete(w);

                    bannedWordsJson = JSON.stringify(Array.from(bannedWords));
                    console.log("知乎推荐流优化 用户屏蔽词库: " + bannedWordsJson);
                    GM_setValue("bannedWords", bannedWordsJson);
                    alert(`知乎推荐流优化 已删除屏蔽词: ${JSON.stringify(wordlist)} \n当前屏蔽词库: ${bannedWordsJson}`);
                }
            }
        }

        function menuSetAnswerCountThreshold(){
            let threshold = prompt("知乎推荐流优化 请输入数值: \n答案数量阈值用于确定是否移除使用默认头像，但有较多回答数的账号生产的内容", answerCountThreshold);
            if (!isNaN(parseInt(threshold))){
                GM_setValue("answerCountThreshold", parseInt(threshold));
                answerCountThreshold = parseInt(threshold);
                menuUpdateVariableMenuInOrder();
            }
        }

        function menuSetNewCardsCountThreshold(){
            let threshold = prompt("知乎推荐流优化 请输入数值: \n新卡片数量阈值用于设定下滑刷新内容时需要多少新卡片来触发移除机制", newCardsThreshold);
            if (!isNaN(parseInt(threshold))){
                GM_setValue("newCardsThreshold", parseInt(threshold));
                newCardsThreshold = parseInt(threshold);
                menuUpdateVariableMenuInOrder();
            }
        }

        function menuToggleUsernameAuxJudgment(){
            usernameAuxJudgment = !usernameAuxJudgment;
            GM_setValue("usernameAuxJudgment", (usernameAuxJudgment ? 1 : 0));
            menuUpdateVariableMenuInOrder();
        }

        function menuToggleAutoSendUninterest(){
            autoSendUninterestWithBannedWordCard = !autoSendUninterestWithBannedWordCard;
            GM_setValue("autoSendUninterestWithBannedWordCard", (autoSendUninterestWithBannedWordCard ? 1 : 0));
            menuUpdateVariableMenuInOrder();
        }

        // 用于确保刷新数据后 在脚本管理器菜单里的各个项目顺序是正确的
        function menuUpdateVariableMenuInOrder(){
            GM_unregisterMenuCommand(setAnswerCountThresholdMenuId);
            GM_unregisterMenuCommand(setNewCardsCountThresholdMenuId);
            GM_unregisterMenuCommand(toggleUsernameAuxJudgmentMenuId);
            GM_unregisterMenuCommand(toggleAutoSendUninterestMenuId);

            setAnswerCountThresholdMenuId = GM_registerMenuCommand(`设置答案数量阈值（${answerCountThreshold}）`, menuSetAnswerCountThreshold);
            setNewCardsCountThresholdMenuId = GM_registerMenuCommand(`设置新卡片数量阈值（${newCardsThreshold}）`, menuSetNewCardsCountThreshold);
            toggleUsernameAuxJudgmentMenuId = GM_registerMenuCommand(`切换用户名辅助判定（${usernameAuxJudgment ? "是" : "否"}）`, menuToggleUsernameAuxJudgment, {autoClose: false});
            toggleAutoSendUninterestMenuId = GM_registerMenuCommand(`切换自动点击不感兴趣（${autoSendUninterestWithBannedWordCard ? "是" : "否"}）`, menuToggleAutoSendUninterest, {autoClose: false});
        }

        GM_registerMenuCommand("添加屏蔽词", menuAddBannedWords);
        GM_registerMenuCommand("删除屏蔽词", menuRemoveBannedWords);
        menuUpdateVariableMenuInOrder();

        console.log("知乎推荐流优化 已完成加载");
        console.log("知乎推荐流优化 用户屏蔽词库: " + JSON.parse(bannedWordsJson).join(","));
        console.log("知乎推荐流优化 答案数量阈值: " + answerCountThreshold);
        console.log("知乎推荐流优化 新卡片数量阈值: " + newCardsThreshold);
        console.log("知乎推荐流优化 是否使用用户名作为辅助判断: " + (usernameAuxJudgment ? "是" : "否"));
        console.log("知乎推荐流优化 是否自动对匹配屏蔽词的卡片点击不感兴趣: " + (autoSendUninterestWithBannedWordCard ? "是" : "否"));
    })();

    const recomBody = document.querySelector("div.Topstory-recommend");
    const recomButton = document.querySelector("a.TopstoryTabs-link.Topstory-tabsLink.is-active[aria-controls='Topstory-recommend']");

    if (recomBody) {
        console.log("知乎推荐流优化 在推荐列表变动时检查卡片");
        const bodyObConfig = {attributes: false, childList: true, subtree: true};
        const bodyObserver = new MutationObserver(isNodeAddedCallback);
        bodyObserver.observe(recomBody, bodyObConfig);
    }
    // setInterval(showArrayContent, 5000);
    pageReloadCheck();
    recomButton.addEventListener("click", pageReloadCheck);
})();
