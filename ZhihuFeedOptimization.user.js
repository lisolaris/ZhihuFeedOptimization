// ==UserScript==
// @name        知乎推荐流优化
// @namespace   ZhihuFeedOptimization
// @license     GPLv3
// @match       https://www.zhihu.com/
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// @grant       GM_unregisterMenuCommand
// @version     0.2.1
// @run-at      document-idle
// @author      lisolaris
// @icon        https://www.google.com/s2/favicons?sz=64&domain=zhihu.com
// @description 优化知乎首页推荐流的内容，如移除灌水用户、按屏蔽词屏蔽等
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

    // function addBannedWords(card){
    //     alert(card.querySelector("h2").textContent);
    // }

    function checkIfBannedWordInCard(newCards=null){
        for (let card of newCards){
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

    async function checkIfAuthorDefaultAvatarInCard(newCards=null){
        var cards;
        if (!newCards) cards = document.getElementsByClassName("Card TopstoryItem TopstoryItem-isRecommend");
        else cards = newCards;

        const fetchPromises = [];
        for (let card of cards) {
            // 每个内容卡片都具有class: "ContentItem ArticleItem"或"ContentItem AnswerItem"
            let cardItem = card.querySelector("div.ContentItem");
            // console.log("card: " + card.textContent)

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
                                    if (data.avatar_url_template.toLowerCase().includes(DEFAULTAVATARHASH)){
                                        console.log(`%c知乎推荐流优化 待删除列表中加入: ${userId}, 原因: 默认头像`, "color:#00A2E8");
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

        checkIfBannedWordInCard(newCards);
        checkIfAuthorDefaultAvatarInCard(newCards);
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

        if (newAddedCards.size >= 5){
            checkCards(Array.from(newAddedCards));
            newAddedCards.clear();
        }
    }

    function setNewCardsCountThreshold(){
        let threshold = prompt("请输入数值:", "5");
        if (isNaN(parseInt(threshold))){
            GM_setValue("threshold", parseInt(threshold));
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

    GM_registerMenuCommand("添加屏蔽词", addBannedWords);
    GM_registerMenuCommand("删除屏蔽词", removeBannedWords);
    GM_registerMenuCommand("查看屏蔽词列表", showBannedWords);
    GM_registerMenuCommand("清空屏蔽词列表", purgeBannedWords);
    GM_registerMenuCommand("设置新卡片数量阈值", setNewCardsCountThreshold);

    console.log("知乎推荐流优化 已完成加载");
    console.log("知乎推荐流优化 用户屏蔽词库: " + JSON.stringify(Array.from(bannedWords)));
    
    const recomBody = document.querySelector("div.Topstory-recommend");

    if (recomBody) {
        console.log("知乎推荐流优化 在推荐列表变动时检查卡片");
        const obconfig = {attributes: false, childList: true, subtree: true};
        const observer = new MutationObserver(isNodeAddedCallback);
        observer.observe(recomBody, obconfig);

        // console.log("知乎推荐流优化 开始初次检查");
        // sleep(1500);
        // findDefaultAvatarCard();

    }
    // setInterval(showArrayContent, 5000);
})();
