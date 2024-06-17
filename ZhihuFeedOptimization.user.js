// ==UserScript==
// @name        知乎推荐流优化
// @namespace   ZhihuFeedOptimization
// @license     GPLv3
// @match       https://www.zhihu.com/
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// @grant       GM_unregisterMenuCommand
// @version     0.2.5
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
    const cardsToBeDeleted = new Set();

    const bannedWords = new Set();
    var bannedWordsJson = GM_getValue("bannedWords", "");
    if (bannedWordsJson.length)
        for (let word of JSON.parse(bannedWordsJson)) 
            bannedWords.add(word);

    var newCardsThreshold = parseInt(GM_getValue("newCardsThreshold", "5"));
    var answerCountThreshold = parseInt(GM_getValue("answerCountThreshold", "200"));
    var usernameAuxJudgment = parseInt(GM_getValue("usernameAuxJudgment", "1"));

    var setNewCardsCountThresholdMenuId = null;
    var setAnswerCountThresholdMenuId = null;
    var toggleUsernameAuxJudgmentMenuId = null;

    function checkIfBannedWordInCard(newCards){
        for (let card of newCards){
            // TODO: 将屏蔽词选项加入到卡片底部按钮三点式菜单（更多）里
            // console.log("checkIfBannedWordInCard(): " + card.textContent)
            // // 删除知乎自带的设置屏蔽词按钮（会员可用） 加入一个新的
            // let button = card.querySelector("button.Button.OptionsButton[aria-label='更多']");
            // button.addEventListener("click", (function(){
            //     let popWind = document.querySelector("div.Popover-content.Popover-content--bottom.Popover-content--arrowed.Popover-content-enter-done");
            //     popWind.querySelector("button.TopstoryItem-menuItem").remove();

            //     var addBlockButtonElem = document.createElement("button");
            //     addBlockButtonElem.className = "Button Menu-item AnswerItem-selfMenuItem Button--plain";
            //     addBlockButtonElem.type = "button";
            //     addBlockButtonElem.addEventListener("click", alert("???"));

            //     popWind.querySelector("div.Menu").appendChild(addBlockButtonElem);
            //     }));

            // 检查标题是否含有用户屏蔽词
            for (let word of bannedWords){
                if (card.querySelector("h2").textContent.includes(word)){
                    let cardItem = card.querySelector("div.ContentItem");
                    let extraInfo = JSON.parse(cardItem.getAttribute("data-za-extra-module"));
                    let userId = extraInfo.card.content.author_member_hash_id;
                    console.log(`%c知乎推荐流优化 待删除列表中加入: ${userId}, 原因: 用户屏蔽词 ${word}`, "color:#00A2E8");
                    cardsToBeDeleted.add(card);
                    break;
                }
            }
        }
    }

    async function checkIfAuthorDefaultAvatarInCard(newCards){
        const fetchPromises = [];
        for (let card of newCards) {
            // 每个内容卡片都具有class: "ContentItem ArticleItem"或"ContentItem AnswerItem"
            // console.log("card: " + card.textContent)
            let cardItem = card.querySelector("div.ContentItem");
            let extraInfo = JSON.parse(cardItem.getAttribute("data-za-extra-module"));
            let userId = extraInfo.card.content.author_member_hash_id;

            // 此用户已经被检查过/将要检查的卡片已经在待删除列表里 跳过检查
            if (userChecked.has(userId) || cardsToBeDeleted.has(card)) continue;
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
                                    // 判定条件: 是默认头像 且 (回答数小于设定阈值 或 (用户是否启用 与 以'知乎用户'为用户名的开头))
                                    // 真值表参见说明文档
                                    if (data.avatar_url_template.toLowerCase().includes(DEFAULTAVATARHASH) &&
                                        (data.answer_count < answerCountThreshold || (usernameAuxJudgment && data.name.search(/^知乎用户/) == 0))){
                                        console.log(`%c知乎推荐流优化 待删除列表中加入: ${userId}, 原因: 默认头像${(data.name.search(/^知乎用户/) == 0) ? ' 默认用户名': ''}, 用户回答数量: ${data.answer_count}`, "color:#00A2E8");
                                        cardsToBeDeleted.add(card);
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
        if (cardsToBeDeleted.size > 0) {
            console.log("知乎推荐流优化 开始移除卡片");

            for (let card of cardsToBeDeleted){
                let cardItem = card.querySelector("div.ContentItem");
                let text = card.querySelector("span.RichText.ztext.CopyrightRichText-richText").textContent;
                const urls = [];
                if (card.querySelectorAll("meta[itemprop='url']").length != 0){
                    for (let url of card.querySelectorAll("meta[itemprop='url']")){
                        urls.push(url.getAttribute("content"));
                    }
                }
                console.log(`%c知乎推荐流优化 已移除卡片: ${cardItem.getAttribute("data-zop")}, 原链接: ${JSON.stringify(urls)}, 预览: ${text}`, "color:#FF00FF");
                // 不可使用card.remove() 会导致点击首页顶部推荐按钮刷新页面时出错（removeChild()失败）
                card.setAttribute("hidden", "")
            }
            cardsToBeDeleted.clear();
        }
    }

    function showArrayContent() {
        console.log(`toBeDeleted(${cardsToBeDeleted.size}): ` + JSON.stringify(Array.from(cardsToBeDeleted)));
        console.log(`userChecked(${userChecked.size}): ` + JSON.stringify(Array.from(userChecked)));
    }

    async function checkCards(newCards=null){
        console.log("知乎推荐流优化 检查新获得的推荐卡片列表……");
        var cards;
        if (!newCards) cards = Array.from(document.getElementsByClassName("Card TopstoryItem TopstoryItem-isRecommend"));
        else cards = newCards;
        checkIfBannedWordInCard(cards);
        checkIfAuthorDefaultAvatarInCard(cards);
    }

    // 当检查到推荐流列表发生更新时的回调函数
    // 在新增的卡片超过五个后即将新增的卡片传入findDefaultAvatarCard()对作者头像进行检查
    function isNodeAddedCallback(mutationRecords, observer){
        const newAddedCards = new Set();

        for (let mutation of mutationRecords){
            if (mutation.addedNodes.length != 0){
                if (mutation.addedNodes[0].className === "Card TopstoryItem TopstoryItem-isRecommend")
                    newAddedCards.add(mutation.addedNodes[0]);
            }
        }

        if (newAddedCards.size >= newCardsThreshold){
            checkCards(Array.from(newAddedCards));
            newAddedCards.clear();
        }
    }

    function addBannedWords(){
        let words = prompt("请输入屏蔽词，输入多个时以','分隔: ");
        console.log("知乎推荐流优化 用户输入: " + words);
        if (words){
            words = words.replaceAll(/\s*/g,"").replaceAll("，", ",");

            let wordlist = words.split(",");
            for (let w of wordlist) bannedWords.add(w);
            console.log(Array.from(bannedWords));
            bannedWordsJson = JSON.stringify(Array.from(bannedWords));
            GM_setValue("bannedWords", bannedWordsJson);
            alert("知乎推荐流优化 已添加屏蔽词: \n" + JSON.stringify(wordlist));
        }
    }

    function removeBannedWords(){
        let words = prompt("请输入要移除的屏蔽词，输入多个时以','分隔: ");
        console.log("知乎推荐流优化 用户输入: " + words);
        if (words){
            words = words.replaceAll(/\s*/g,"").replaceAll("，", ",");

            let wordlist = words.split(",");
            for (let w of wordlist) bannedWords.delete(w);

            bannedWordsJson = JSON.stringify(Array.from(bannedWords));
            GM_setValue("bannedWords", bannedWordsJson);
            alert(`知乎推荐流优化 已删除屏蔽词 \n当前屏蔽词库: ${bannedWordsJson}`);
        }
    }

    function showBannedWords(){
        bannedWordsJson = GM_getValue("bannedWords");
        alert(`知乎推荐流优化 屏蔽词列表: \n${bannedWordsJson}`);
    }

    function purgeBannedWords(){
        bannedWordsJson = "";
        bannedWords.clear();
        GM_setValue("bannedWords", bannedWordsJson);
        alert("知乎推荐流优化 已清空屏蔽词列表");
        console.log(Array.from(bannedWords));
    }

    function setAnswerCountThreshold(){
        let threshold = prompt("知乎推荐流优化 请输入数值: \n答案数量阈值用于确定是否移除使用默认头像，但有较多回答数的账号生产的内容", answerCountThreshold);
        if (!isNaN(parseInt(threshold))){
            GM_setValue("answerCountThreshold", parseInt(threshold));
            answerCountThreshold = parseInt(threshold);
            updateVariableMenuInOrder();
        }
    }

    function setNewCardsCountThreshold(){
        let threshold = prompt("知乎推荐流优化 请输入数值: \n新卡片数量阈值用于设定下滑刷新内容时需要多少新卡片来触发移除机制", newCardsThreshold);
        if (!isNaN(parseInt(threshold))){
            GM_setValue("newCardsThreshold", parseInt(threshold));
            newCardsThreshold = parseInt(threshold);
            updateVariableMenuInOrder();
        }
    }

    function toggleUsernameAuxJudgment(){
        usernameAuxJudgment = !usernameAuxJudgment;
        GM_setValue("usernameAuxJudgment", usernameAuxJudgment);
        updateVariableMenuInOrder();
    }

    // 用于确保刷新数据后 在脚本管理器菜单里的各个项目顺序是正确的
    function updateVariableMenuInOrder(){
        GM_unregisterMenuCommand(setAnswerCountThresholdMenuId);
        GM_unregisterMenuCommand(setNewCardsCountThresholdMenuId);
        GM_unregisterMenuCommand(toggleUsernameAuxJudgmentMenuId);
        setAnswerCountThresholdMenuId = GM_registerMenuCommand(`设置答案数量阈值（${answerCountThreshold}）`, setAnswerCountThreshold);
        setNewCardsCountThresholdMenuId = GM_registerMenuCommand(`设置新卡片数量阈值（${newCardsThreshold}）`, setNewCardsCountThreshold);
        toggleUsernameAuxJudgmentMenuId = GM_registerMenuCommand(`切换用户名辅助判定（${usernameAuxJudgment ? "是" : "否"}）`, toggleUsernameAuxJudgment, {autoClose: false});
    }

    GM_registerMenuCommand("添加屏蔽词", addBannedWords);
    GM_registerMenuCommand("删除屏蔽词", removeBannedWords);
    GM_registerMenuCommand("查看屏蔽词列表", showBannedWords);
    GM_registerMenuCommand("清空屏蔽词列表", purgeBannedWords);
    updateVariableMenuInOrder();

    console.log("知乎推荐流优化 已完成加载");
    console.log("知乎推荐流优化 用户屏蔽词库: " + JSON.stringify(Array.from(bannedWords)));
    console.log("知乎推荐流优化 答案数量阈值: " + answerCountThreshold);
    console.log("知乎推荐流优化 新卡片数量阈值: " + newCardsThreshold);
    console.log("知乎推荐流优化 是否使用用户名作为辅助判断: " + usernameAuxJudgment);

    const recomBody = document.querySelector("div.Topstory-recommend");

    if (recomBody) {
        console.log("知乎推荐流优化 在推荐列表变动时检查卡片");
        const obconfig = {attributes: false, childList: true, subtree: true};
        const observer = new MutationObserver(isNodeAddedCallback);
        observer.observe(recomBody, obconfig);

        console.log("知乎推荐流优化 开始初次检查");
        // 不知道为什么卡片中data-za-extra-module这个属性会在整个页面的DOM树加载完成后才被添加进去 等待一下再进行初次检查
        if (document.querySelector("div.ContentItem").getAttribute("data-za-extra-module"))
            checkCards(recomBody.querySelectorAll("div.Card.TopstoryItem.TopstoryItem-isRecommend"));
    }
    // setInterval(showArrayContent, 5000);
})();
