# 知乎推荐流优化  

此项目的目的在于优化知乎首页推荐流的浏览体验。  

目前的功能有：  

+ 删除推荐流中使用默认头像的用户生产的回答（连头像都不换就来灌水了！），通过监视推荐流列表元素的更新并在新加入的卡片数量达到5个（默认值，可更改）时查询API检查用户头像；由于知乎默认头像具有一个特定的名称（v2_abed1a8c04700ba7d72b45195223e0ff.jpg），所以只需要检查头像图像的链接而不用下载图片就可以实现检查。  
  为了避免误伤使用默认头像但生产了较多内容的用户，可以对用户回答数量阈值和是否使用用户名辅助判断进行设置。其真值表如下：  

|屏蔽词匹配标题|是默认头像|回答数小于设定阈值|启用用户名辅助判断|用户名以“知乎用户”开头|是否移除|  
|:-:|:-:|:-:|:-:|:-:|:-:|  
|1|-|-|-|-|1|  
|0|1|1|1|1|1|  
|0|1|1|1|0|1|  
|0|1|0|1|0|0|  
|0|1|0|1|1|1|  
|0|1|0|0|-|0|  
|0|0|-|-|-|0|  

+ 删除标题中含有用户自定义的屏蔽词的问题卡片。可以通过点击浏览器用户脚本管理器扩展，并在弹出的菜单-知乎推荐流优化下的子菜单中设置管理屏蔽词项目；保存的屏蔽词以JSON格式储存在脚本管理器中。  

+ 自动点击标题中含有用户自定义的屏蔽词的问题卡片的“不感兴趣”这一项，有助于让知乎推荐算法了解你的习惯。~~但作者本人实测不管点多少次不感兴趣，知乎还是会推~~

已移除的卡片详情会输出在控制台，例如：
> 知乎推荐流优化 待删除列表中加入: f36e118d800ad24cd156355993119b0c, 原因: 默认头像  
>
> 知乎推荐流优化 待删除列表中加入: 26a6c20cecfaca53f27a129bcc2986fd, 原因: 用户屏蔽词 姜萍
>
> 知乎推荐流优化 已移除卡片: {"authorName":"没有知识的荒原","itemId":3536804512,"title":"现在大家对姜萍事件都是什么看法？","type":"answer"}, 原链接: ["<https://www.zhihu.com/question/659369271>","<https://www.zhihu.com/question/659369271/answer/3536804512>"], 预览: 没有知识的荒原： 知乎的封神之战，事实证明知乎上懂数学的人的比例在各大软件中算高的。, 已不感兴趣: 是

可以按F12打开开发者控制台查看输出的日志。

这是我第一次学习JavaScript写出的脚本，所以迭代会很快；未来预计还会添加更多功能，等待更新……  

脚本在Firefox 127.0, ViolentMonkey 2.19.0上测试可用。  

**更新历史**  

v0.3.3 重新编写一部分代码实现检查用户信息部分的解耦；尝试屏蔽评论区中的默认头像用户发言但效果不是很好，暂不启用；在首次页面加载后延迟2000ms即开始检查页面而不是等待DOMContentLoaded事件发生，以实现0.3.2中并未修复的“确保最顶上的几个卡片会被检查”

v0.3.2 为页面重加载（点击首页顶部推荐按钮）后调用的pageReloadCheck()增加1000ms的延迟，第一个卡片加载出来后才开始检查以确保最顶上的几个卡片会被检查；[代码仓库](https://github.com/lisolaris/ZhihuFeedOptimization)中新增屏蔽词列表bannedwords.txt，仅供参考（

v0.3.1 修复 忘记给切换是否自动不感兴趣的菜单写回调了！直接复制了上面那个菜单的代码导致点一下切换不感兴趣，用户名辅助判定的菜单反而会变==；为每次检查加入延迟，尝试修复cardItem为空的问题

v0.3.0 加入新功能：可选是否对推送到首页标题中含屏蔽词的问题自动点击“不感兴趣”；去除菜单中“查看屏蔽词列表”一项，如有需要可以打开控制台查看；去除菜单中“清空屏蔽词列表”一项，可以在“删除屏蔽词”菜单中输入“清空全部屏蔽词！”来清空（是中文感叹号）；优化脚本加载完成后在控制台输出的屏蔽词列表日志信息，可以直接复制并通过“添加屏蔽词”菜单导入；修正脚本答案数量阈值标称默认为100，实际上为200的问题；补充0.2.6更新日志中`增加“清空屏蔽词列表的确认提示”` ~~忘记了~~  

v0.2.6 为首页推荐按钮增加事件监听器，现在通过推荐按钮刷新页面时也会执行检查了；去除菜单中“查看屏蔽词列表”一项，如有需要可以打开控制台查看；增加“清空屏蔽词列表的确认提示；优化代码结构

v0.2.5 加入更多判断条件：用户答案数量（默认阈值为100）与用户名是否为默认（以"知乎用户"开头），用于避免误伤使用默认头像但有较多回答的正常用户，并可在脚本管理器菜单中设置是否使用这些条件  

v0.2.4 尝试修复页面首次加载完成时脚本不会检查已有卡片，只会在向下滑时检查新增卡片的问题；加入greasyfork的自动更新链接，请务必更新  

v0.2.3 ~~版本号命名失误了，这个版本应该叫v0.3.0的~~ 加入用户屏蔽词与自定义新卡片数量阈值功能，现在可以通过脚本管理器点击对应的选项进行设置了  

v0.2.2 改变卡片移除逻辑（原本使用Element.remove()直接移除元素，但知乎自身逻辑会在通过点击首页的“推荐”按钮刷新页面时尝试移除所有曾添加的卡片，导致崩溃需重新加载整个页面；新方法通过给要移除的卡片加上"hidden"属性实现）；加入控制台log颜色  

v0.2.1 使用MutationObserver对向下滑动时新加入的卡片进行增量式处理，摒弃每次页面有变动即检查所有卡片（包括检查过的）的低效率形式

v0.2 除通过知乎api获取用户信息外的部分几乎全部重写，将获取头像与移除卡片的逻辑分离  

v0.1-alpha 完成脚本的基本构建，测试可用  

也请参见：[Github仓库地址](https://github.com/lisolaris/ZhihuFeedOptimization) [Greasyfork页面](https://greasyfork.org/zh-CN/scripts/498139-%E7%9F%A5%E4%B9%8E%E6%8E%A8%E8%8D%90%E6%B5%81%E4%BC%98%E5%8C%96)  
